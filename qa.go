package apidocs

import (
	"encoding/json"
	"fmt"
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

func (q *QATracker) HandleGetData(c *fiber.Ctx) error {
	q.mu.RLock()
	defer q.mu.RUnlock()
	return c.JSON(q.loadData())
}

func (q *QATracker) HandleSaveRecord(c *fiber.Ctx) error {
	var req EndpointRecord
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid payload"})
	}
	if req.EndpointKey == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "endpoint_key is required"})
	}
	if req.TestedAt == "" {
		req.TestedAt = time.Now().Format("2006-01-02 15:04:05")
	}

	q.mu.Lock()
	defer q.mu.Unlock()

	data := q.loadData()
	data[req.EndpointKey] = req
	if err := q.saveData(data); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to persist QA record"})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"record":  req,
	})
}

func (q *QATracker) HandleResetData(c *fiber.Ctx) error {
	q.mu.Lock()
	defer q.mu.Unlock()

	empty := make(map[string]EndpointRecord)
	if err := q.saveData(empty); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to reset QA data"})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "QA records reset successfully",
	})
}

func (q *QATracker) HandleGetReport(c *fiber.Ctx) error {
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

	if c.Query("format") == "json" {
		return c.JSON(fiber.Map{
			"total":   total,
			"passed":  passed,
			"failed":  failed,
			"retest":  retest,
			"records": data,
			"report":  md.String(),
		})
	}

	c.Set("Content-Type", "text/markdown; charset=utf-8")
	return c.SendString(md.String())
}
