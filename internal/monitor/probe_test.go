package monitor

import (
	"testing"

	"monitor/internal/storage"
)

func TestEvaluateStatusWithoutSuccessContains(t *testing.T) {
	t.Parallel()

	status, subStatus := evaluateStatus(1, storage.SubStatusNone, []byte("anything"), "")
	if status != 1 {
		t.Fatalf("expected status 1 when success_contains is empty, got %d", status)
	}
	if subStatus != storage.SubStatusNone {
		t.Fatalf("expected SubStatusNone, got %s", subStatus)
	}
}

func TestEvaluateStatusWithMatchingContent(t *testing.T) {
	t.Parallel()

	body := []byte(`{"ok":true,"message":"pong"}`)
	status, subStatus := evaluateStatus(1, storage.SubStatusNone, body, "pong")
	if status != 1 {
		t.Fatalf("expected status 1 when body contains keyword, got %d", status)
	}
	if subStatus != storage.SubStatusNone {
		t.Fatalf("expected SubStatusNone, got %s", subStatus)
	}
}

func TestEvaluateStatusWithNonMatchingContent(t *testing.T) {
	t.Parallel()

	body := []byte(`{"ok":false,"message":"error"}`)
	status, subStatus := evaluateStatus(1, storage.SubStatusNone, body, "pong")
	if status != 0 {
		t.Fatalf("expected status 0 when body does not contain keyword, got %d", status)
	}
	if subStatus != storage.SubStatusContentMismatch {
		t.Fatalf("expected SubStatusContentMismatch, got %s", subStatus)
	}
}
