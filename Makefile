# Clipper.ai — one-command local stack (Capstone D1).
# Requires Docker (or a compatible engine such as Colima) + the compose plugin.

.PHONY: up demo verify seed smoke down logs

# Bring up the full app: db + backend (API + workers) + frontend.
#   frontend → http://localhost:5173   backend → http://localhost:8080
up:
	docker compose up --build

# Full demo in one command: start the stack, then seed real captioned clips.
demo:
	docker compose up --build -d
	docker compose --profile seed run --rm seed

# Run the offline smoke suite against the stack (the acceptance gate).
verify: smoke
smoke:
	docker compose up --build -d backend
	docker compose --profile test run --rm smoke

# Seed only (stack assumed up).
seed:
	docker compose --profile seed run --rm seed

# Tear down, including the database volume.
down:
	docker compose down -v

logs:
	docker compose logs -f
