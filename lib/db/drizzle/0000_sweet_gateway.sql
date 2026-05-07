CREATE TABLE "participants" (
	"slot" varchar(1) PRIMARY KEY NOT NULL,
	"name" text,
	"pin" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" varchar(32) PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"slot" varchar(1) NOT NULL,
	"date" date NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" varchar(32) PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"category_id" varchar(32) NOT NULL,
	"content" text NOT NULL,
	"date" varchar(10) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "categories_slot_date_idx" ON "categories" USING btree ("slot","date");--> statement-breakpoint
CREATE INDEX "items_category_idx" ON "items" USING btree ("category_id");