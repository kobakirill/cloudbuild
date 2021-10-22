.PHONY: test lint lint-fix build-server build-worker

test:
	go test -v ./...

lint:
	go install github.com/golangci/golangci-lint/cmd/golangci-lint@v1.42.1
	golangci-lint run ./...

lint-fix:
	go mod tidy
	go install github.com/golangci/golangci-lint/cmd/golangci-lint@v1.42.1
	golangci-lint run --fix ./...

build-server:
	rm -rf ./bin/server
	go build -o ./bin/server -trimpath ./cmd/server/main.go

build-worker:
	rm -rf ./bin/worker
	go build -o ./bin/worker -trimpath ./cmd/worker/main.go
