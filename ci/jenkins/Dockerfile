# Keep Bun aligned with .github/workflows/ci.yml and Go with apps/backend/go.mod.
FROM golang:1.26.2-bookworm AS go
FROM oven/bun:1.1.30 AS bun

# The full Debian image includes git, CA certificates, and GCC for go test -race.
FROM node:24-bookworm

COPY --from=go /usr/local/go /usr/local/go
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun

ENV PATH="/usr/local/go/bin:${PATH}" \
    CGO_ENABLED=1

RUN node --version && bun --version && go version && git --version && gcc --version