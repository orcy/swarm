BIN = ./node_modules/.bin
PACKAGES = \
	swarm-bat \
	swarm-stamp \
	swarm-syncable \
	swarm-replica \
	swarm-server \
	swarm-client \
	swarm-gw \


foreach_package = $(foreach pkg,$(PACKAGES),(cd $(pkg) && $(1)) || exit 1;)

.PHONY: bootstrap install test

install:
	@npm install .
	@$(call foreach_package, npm install)

bootstrap: install
	@node ./scripts/bootstrap.js

test:
	@$(call foreach_package, make test)

clean:
	@rm -rf node_modules
	@$(call foreach_package, make clean)
