FROM golang:1.25-bookworm AS build
ENV CGO_ENABLED=0
RUN go install github.com/minio/minio@RELEASE.2025-10-15T17-29-55Z
RUN cp $(go env GOPATH)/pkg/mod/github.com/minio/minio@*/LICENSE /minio-LICENSE

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && rm -rf /var/lib/apt/lists/*
COPY --from=build /go/bin/minio /usr/local/bin/minio
COPY --from=build /minio-LICENSE /usr/share/doc/minio/LICENSE
EXPOSE 9000 9001
ENTRYPOINT ["minio"]
