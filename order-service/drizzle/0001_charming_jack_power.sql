CREATE TYPE "public"."saga_step" AS ENUM('STARTED', 'RESERVING_INVENTORY', 'INVENTORY_RESERVED', 'PROCESSING_PAYMENT', 'PAYMENT_COMPLETED', 'RELEASING_INVENTORY', 'COMPLETED', 'COMPENSATED', 'FAILED');--> statement-breakpoint
CREATE TABLE "saga_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"step" "saga_step" DEFAULT 'STARTED' NOT NULL,
	"reservation_id" uuid,
	"payment_id" uuid,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saga_instances_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
ALTER TABLE "saga_instances" ADD CONSTRAINT "saga_instances_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;