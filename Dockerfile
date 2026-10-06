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
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /go-apidocs ./cmd/go-apidocs

# Stage 3: Minimal Production Image
FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app

# Create sandboxed data directory
RUN mkdir -p /app/apidocs-data /app/docs

# Copy standalone binary
COPY --from=go-builder /go-apidocs /usr/local/bin/go-apidocs

# Expose HTTP port
EXPOSE 8080

# Configure environment defaults
ENV PORT=8080 \
    STORAGE_ROOT=/app/apidocs-data \
    QA_STORAGE=/app/docs/qa_tracker.json \
    NVIDIA_MODEL=deepseek-ai/deepseek-v4.1-flash \
    NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1

# Default entrypoint
ENTRYPOINT ["/usr/local/bin/go-apidocs"]
CMD ["--spec=/app/docs/swagger.json", "--storage-root=/app/apidocs-data", "--workspaces=true", "--allow-imports=true", "--security-audit=true"]
