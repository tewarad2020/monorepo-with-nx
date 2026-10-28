pipeline {
    agent {
        dockerfile {
            dir 'ci/jenkins'
            label 'docker'
        }
    }

    options {
        timeout(time: 20, unit: 'MINUTES')
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '20', artifactNumToKeepStr: '10'))
    }

    triggers {
        // Requires the GitHub plugin and a reachable /github-webhook/ endpoint.
        githubPush()
    }

    environment {
        CI = 'true'
        NX_DAEMON = 'false'
        NX_TUI = 'false'
        // Build without requiring an Nx Cloud account or secret.
        NX_NO_CLOUD = 'true'
        // Jenkins runs containers as the agent UID, which may have no home directory.
        HOME = "${WORKSPACE}/.jenkins-home"
        GOPATH = "${WORKSPACE}/.jenkins-home/go"
        GOCACHE = "${WORKSPACE}/.jenkins-home/go-build"
        CGO_ENABLED = '1'
    }

    stages {
        stage('Toolchain') {
            steps {
                sh '''
                    set -eu
                    mkdir -p "$HOME" "$GOPATH" "$GOCACHE"
                    node --version
                    bun --version
                    go version
                    gcc --version
                '''
            }
        }

        stage('Install dependencies') {
            steps {
                sh 'bun install --frozen-lockfile'
            }
        }

        stage('Check and build') {
            steps {
                // Run all projects, including on the first build and shallow checkouts.
                sh 'bun run check'
            }
        }

        stage('Archive artifacts') {
            steps {
                // Fail rather than publish an incomplete build if either output is missing.
                sh 'test -s apps/dist/frontend/index.html && test -x dist/backend/todo-backend'
                archiveArtifacts artifacts: 'apps/dist/frontend/**', fingerprint: true
                archiveArtifacts artifacts: 'dist/backend/todo-backend', fingerprint: true
            }
        }
    }
}