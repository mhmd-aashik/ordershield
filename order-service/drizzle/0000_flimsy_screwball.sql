CREATE TYPE "public"."order_status" AS ENUM('PENDING', 'INVENTORY_RESERVED', 'PAYMENT_COMPLETED', 'CONFIRMED', 'COMPENSATING', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" varchar(100) NOT NULL,
	"quantity" integer NOT NULL,
	"amount" integer NOT NULL,
	"status" "order_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
