# Copyright (c) 2022-2026 Datalayer, Inc.
#
# Datalayer License

SHELL=/bin/bash
.DEFAULT_GOAL := help

help: ## display this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-18s\033[0m %s\n", $$1, $$2}'

clean: ## remove build outputs
	npm run clean; rm -rf app/dist share/datalayer/reactor style src/decksCss.ts

build-lib: ## build the TypeScript package into lib/
	npm run build

build-app: build-lib ## build the interface into share/ (what the wheel carries)
	npm run build --prefix app

build-extension: build-lib ## build the Module Federation container into share/ (what other hosts load)
	npm run extension:build

build: build-app build-extension ## build everything the wheel carries

wheel: build ## build the wheel, JavaScript included
	python -m build --wheel

typecheck: ## type-check the package against the reactor source
	npm run typecheck

test: ## run the TypeScript and Python tests
	npm test && python -m pytest tests -q

install: ## install the Python package in development mode
	pip install -e ".[test]"

serve: ## serve the decks API and the built interface (`datalayer decks serve`)
	datalayer decks serve

dev-app: ## the interface on :5190 against a server on :8797
	npm run dev --prefix app

publish-npm: clean build-tsc ## publish
	npm publish --access public
	echo open https://www.npmjs.com/package/@datalayer/decks

publish-pypi: # publish the pypi package
	git clean -fdx && \
		python -m build
	@exec echo
	@exec echo twine upload ./dist/*-py3-none-any.whl
	@exec echo
	@exec echo https://pypi.org/project/datalayer-decks/#history

