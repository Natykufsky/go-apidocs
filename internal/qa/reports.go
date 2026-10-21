package qa

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	aiDomain "github.com/Natykufsky/go-apidocs/internal/ai/domain"
)

// Report is a persisted, named AI test execution run.
type Report struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	EndpointKey string    `json:"endpoint_key"`
	Provider    string    `json:"provider,omitempty"`
	Model       string    `json:"model,omitempty"`
	Notes       string    `json:"notes,omitempty"`
	SavedAt     time.Time `json:"saved_at"`
	Summary     struct {
		Total  int `json:"total"`
		Passed int `json:"passed"`
		Failed int `json:"failed"`
	} `json:"summary"`
	Suites  map[string]*aiDomain.TestSuite   `json:"suites,omitempty"`
	Results map[string][]aiDomain.TestResult `json:"results,omitempty"`
}

// ReportStore persists execution reports as JSON files under a root directory.
type ReportStore struct {
	root string
	mu   sync.Mutex
}

// NewReportStore creates (if needed) and returns a report store rooted at dir.
func NewReportStore(dir string) *ReportStore {
	if dir == "" {
		dir = "./docs/qa_reports"
	}
	_ = os.MkdirAll(dir, 0o755)
	return &ReportStore{root: dir}
}

func (s *ReportStore) path(id string) string {
	safe := strings.Map(func(r rune) rune {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9', r == '-', r == '_':
			return r
		}
		return '_'
	}, id)
	return filepath.Join(s.root, safe+".json")
}

// Save persists a report; a new unique ID is assigned when empty.
func (s *ReportStore) Save(r *Report) (*Report, error) {
	if r == nil {
		return nil, fmt.Errorf("nil report")
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	if r.ID == "" {
		r.ID = fmt.Sprintf("r%d", time.Now().UnixNano())
	}
	if r.SavedAt.IsZero() {
		r.SavedAt = time.Now().UTC()
	}
	data, err := json.MarshalIndent(r, "", "  ")
	if err != nil {
		return nil, err
	}
	if err := os.WriteFile(s.path(r.ID), data, 0o644); err != nil {
		return nil, err
	}
	return r, nil
}

// List returns all reports sorted newest-first (metadata only; bodies included).
func (s *ReportStore) List() []Report {
	s.mu.Lock()
	defer s.mu.Unlock()

	entries, err := os.ReadDir(s.root)
	if err != nil {
		return nil
	}
	var out []Report
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".json") {
			continue
		}
		data, err := os.ReadFile(filepath.Join(s.root, e.Name()))
		if err != nil {
			continue
		}
		var rep Report
		if json.Unmarshal(data, &rep) != nil || rep.ID == "" {
			continue
		}
		out = append(out, rep)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].SavedAt.After(out[j].SavedAt) })
	return out
}

// Get loads one report by ID.
func (s *ReportStore) Get(id string) (*Report, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	data, err := os.ReadFile(s.path(id))
	if err != nil {
		return nil, err
	}
	var rep Report
	if err := json.Unmarshal(data, &rep); err != nil {
		return nil, err
	}
	return &rep, nil
}

// Delete removes a report file by ID.
func (s *ReportStore) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return os.Remove(s.path(id))
}
