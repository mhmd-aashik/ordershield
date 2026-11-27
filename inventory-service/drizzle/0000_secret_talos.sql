CREATE TYPE "public"."reservation_status" AS ENUM('RESERVED', 'RELEASED');--> statement-breakpoint
CREATE TABLE "inventory" (
	"product_id" varchar(100) PRIMARY KEY NOT NULL,
	"stock" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_non_negative" CHECK ("inventory"."stock" >= 0)
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" varchar(100) NOT NULL,
	"quantity" integer NOT NULL,
	"status" "reservation_status" DEFAULT 'RESERVED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reservations_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "quantity_positive" CHECK ("reservations"."quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_product_id_inventory_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."inventory"("product_id") ON DELETE no action ON UPDATE no action;