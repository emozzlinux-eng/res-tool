CREATE TABLE "workspaces" (
	"id" text PRIMARY KEY,
	"data" jsonb NOT NULL,
	"updated_at" bigint NOT NULL,
	"created_at" timestamp DEFAULT now()
);
