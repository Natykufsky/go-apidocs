# Multi-stage Dockerfile for go-apidocs standalone microservice

# Stage 1: Build React SPA Frontend
FROM node:20-alpine AS ui-builder
WORKDIR /app/ui
COPY ui/package*.json ./
RUN npm ci
COPY ui/ ./
RUN npm run build

# Stage 2: Build Go Binary
FROM golang:1.24-alpine AS go-builder
WORKDIR /app
RUN apk add --no-cache git ca-certificates
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# Copy compiled UI assets from Stage 1 into assets/dist
COPY --from=ui-builder /app/ui/dist ./assets/dist
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-w -s -buildid=" -o /go-apidocs ./cmd/go-apidocs

# Stage 3: Distroless production image (no shell, no package manager, non-root)
FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app

# Distroless static-debian12 ships ca-certificates & tzdata; the binary is
# fully static (CGO_ENABLED=0) so no libc is required.

# Copy standalone binary
COPY --from=go-builder /go-apidocs /usr/local/bin/go-apidocs

# Writable sandboxed data directories are created at runtime via volume mounts
# (docker-compose / k8s) and are owned by uid 65532.

# Expose HTTP port
EXPOSE 8080

# Configure environment defaults
ENV PORT=8080 \
    STORAGE_ROOT=/app/apidocs-data \
    QA_STORAGE=/app/docs/qa_tracker.json \
    NVIDIA_MODEL=deepseek-ai/deepseek-v4.1-flash \
    NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1

# Drop privileges: distroless nonroot runs as uid 65532
USER 65532:65532

# Default entrypoint
ENTRYPOINT ["/usr/local/bin/go-apidocs"]
CMD ["--spec=/app/docs/swagger.json", "--storage-root=/app/apidocs-data", "--workspaces=true", "--allow-imports=true", "--security-audit=true"]
