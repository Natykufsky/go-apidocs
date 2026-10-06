package usecase

import (
	"context"
	"fmt"

	"github.com/Natykufsky/go-apidocs/internal/ai/domain"
	"github.com/Natykufsky/go-apidocs/internal/ai/port"
	coreDomain "github.com/Natykufsky/go-apidocs/internal/core/domain"
	tenantPort "github.com/Natykufsky/go-apidocs/internal/tenant/port"
)

// GenerateAITestsUseCase coordinates tenant quota verification, LLM execution and usage tracking.
type GenerateAITestsUseCase struct {
	llmClient  port.LLMClientPort
	tenantRepo tenantPort.TenantRepository
}

// NewGenerateAITestsUseCase creates a new AI synthesis use case.
func NewGenerateAITestsUseCase(llm port.LLMClientPort, tr tenantPort.TenantRepository) *GenerateAITestsUseCase {
	return &GenerateAITestsUseCase{
		llmClient:  llm,
		tenantRepo: tr,
	}
}

// Execute validates tenant entitlement and invokes the LLM client port.
func (uc *GenerateAITestsUseCase) Execute(ctx context.Context, tenantID coreDomain.TenantID, opts port.GenerateOptions) (*domain.TestSuite, error) {
	if uc.tenantRepo != nil && tenantID != "" {
		tenant, err := uc.tenantRepo.GetByID(ctx, tenantID)
		if err != nil {
			return nil, fmt.Errorf("tenant lookup failed: %w", err)
		}
		if !tenant.CanGenerateAI() {
			return nil, coreDomain.ErrQuotaExceeded
		}
	}

	suite, err := uc.llmClient.GenerateTests(ctx, opts)
	if err != nil {
		return nil, err
	}

	if uc.tenantRepo != nil && tenantID != "" {
		_ = uc.tenantRepo.RecordAIUsage(ctx, tenantID)
	}

	return suite, nil
}
