package apidocs

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
)

// EndpointRecord holds the QA review and test status of an individual endpoint.
type EndpointRecord struct {
	EndpointKey string `json:"endpoint_key"` // e.g., "GET /api/v1/entities"
	Status      string `json:"status"`       // "passed", "failed", "retest", "untested"
	Comment     string `json:"comment"`
	Tester      string `json:"tester"`
	TestedAt    string `json:"tested_at"`
}

type QATracker struct {
	storagePath string
	title       string
	mu          sync.RWMutex
}

func newQATracker(storagePath, title string) *QATracker {
	if storagePath == "" {
		storagePath = "./docs/qa_tracker.json"
	}
	if title == "" {
		title = "API QA Test & Audit Report"
	}
	_ = os.MkdirAll(filepath.Dir(storagePath), 0755)
	return &QATracker{
		storagePath: storagePath,
		title:       title,
	}
}

func (q *QATracker) loadData() map[string]EndpointRecord {
	data, err := os.ReadFile(q.storagePath)
	if err != nil {
		return make(map[string]EndpointRecord)
	}
	var res map[string]EndpointRecord
	if err := json.Unmarshal(data, &res); err != nil {
		return make(map[string]EndpointRecord)
	}
	if res == nil {
		res = make(map[string]EndpointRecord)
	}
	return res
}

func (q *QATracker) saveData(data map[string]EndpointRecord) error {
	bytes, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(q.storagePath, bytes, 0644)
}

func (q *QATracker) GetData() map[string]EndpointRecord {
	q.mu.RLock()
	defer q.mu.RUnlock()
	return q.loadData()
}

func (q *QATracker) SaveRecord(req EndpointRecord) (EndpointRecord, error) {
	if req.EndpointKey == "" {
		return req, fmt.Errorf("endpoint_key is required")
	}
	if req.TestedAt == "" {
		req.TestedAt = time.Now().Format("2006-01-02 15:04:05")
	}

	q.mu.Lock()
	defer q.mu.Unlock()

	data := q.loadData()
	data[req.EndpointKey] = req
	if err := q.saveData(data); err != nil {
		return req, fmt.Errorf("failed to persist QA record: %w", err)
	}
	return req, nil
}

func (q *QATracker) ResetData() error {
	q.mu.Lock()
	defer q.mu.Unlock()

	empty := make(map[string]EndpointRecord)
	return q.saveData(empty)
}

func (q *QATracker) BuildReport() (string, int, int, int, int, map[string]EndpointRecord) {
	q.mu.RLock()
	data := q.loadData()
	q.mu.RUnlock()

	var total, passed, failed, retest int
	var md strings.Builder

	md.WriteString(fmt.Sprintf("# %s\n", q.title))
	md.WriteString(fmt.Sprintf("*Generated at: %s*\n\n", time.Now().Format("2006-01-02 15:04:05 MST")))

	for _, item := range data {
		total++
		switch item.Status {
		case "passed":
			passed++
		case "failed":
			failed++
		case "retest":
			retest++
		}
	}

	md.WriteString(fmt.Sprintf("### Executive Summary\n- **Total Endpoints Reviewed:** %d\n- **Passed (Working):** %d\n- **Failed (Bugs Found):** %d\n- **Needs Retest:** %d\n\n", total, passed, failed, retest))
	md.WriteString("| Method & Endpoint | Status | Tester | Tested At | QA Comments / Notes |\n")
	md.WriteString("| :--- | :--- | :--- | :--- | :--- |\n")

	for ep, item := range data {
		statusBadge := "⚪ UNTESTED"
		switch item.Status {
		case "passed":
			statusBadge = "🟢 PASSED"
		case "failed":
			statusBadge = "🔴 FAILED / BUG"
		case "retest":
			statusBadge = "🟡 RETEST"
		}

		tester := item.Tester
		if tester == "" {
			tester = "QA / Developer"
		}
		comment := strings.ReplaceAll(item.Comment, "\n", "<br>")
		if comment == "" {
			comment = "-"
		}

		md.WriteString(fmt.Sprintf("| `%s` | %s | %s | %s | %s |\n", ep, statusBadge, tester, item.TestedAt, comment))
	}

	return md.String(), total, passed, failed, retest, data
}

// Standard net/http Handlers
func (q *QATracker) HandleGetDataHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(q.GetData())
}

func (q *QATracker) HandleSaveRecordHTTP(w http.ResponseWriter, r *http.Request) {
	var req EndpointRecord
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid payload"})
		return
	}

	saved, err := q.SaveRecord(req)
	if err != nil {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		if err.Error() == "endpoint_key is required" {
			w.WriteHeader(http.StatusBadRequest)
		} else {
			w.WriteHeader(http.StatusInternalServerError)
		}
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"record":  saved,
	})
}

func (q *QATracker) HandleResetDataHTTP(w http.ResponseWriter, r *http.Request) {
	if err := q.ResetData(); err != nil {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "failed to reset QA data"})
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "QA records reset successfully",
	})
}

func (q *QATracker) HandleGetReportHTTP(w http.ResponseWriter, r *http.Request) {
	reportStr, total, passed, failed, retest, records := q.BuildReport()

	if r.URL.Query().Get("format") == "json" {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"total":   total,
			"passed":  passed,
			"failed":  failed,
			"retest":  retest,
			"records": records,
			"report":  reportStr,
		})
		return
	}

	w.Header().Set("Content-Type", "text/markdown; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(reportStr))
}

// Fiber Handlers
func (q *QATracker) HandleGetData(c *fiber.Ctx) error {
	return c.JSON(q.GetData())
}

func (q *QATracker) HandleSaveRecord(c *fiber.Ctx) error {
	var req EndpointRecord
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid payload"})
	}

	saved, err := q.SaveRecord(req)
	if err != nil {
		if err.Error() == "endpoint_key is required" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "endpoint_key is required"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to persist QA record"})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"record":  saved,
	})
}

func (q *QATracker) HandleResetData(c *fiber.Ctx) error {
	if err := q.ResetData(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to reset QA data"})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "QA records reset successfully",
	})
}

func (q *QATracker) HandleGetReport(c *fiber.Ctx) error {
	reportStr, total, passed, failed, retest, records := q.BuildReport()

	if c.Query("format") == "json" {
		return c.JSON(fiber.Map{
			"total":   total,
			"passed":  passed,
			"failed":  failed,
			"retest":  retest,
			"records": records,
			"report":  reportStr,
		})
	}

	c.Set("Content-Type", "text/markdown; charset=utf-8")
	return c.SendString(reportStr)
}
