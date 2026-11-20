CREATE TABLE "account_notices" (
	"effective_on" date NOT NULL,
	"locale" text NOT NULL,
	"notice" text NOT NULL,
	"sent_at" timestamp with time zone NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "account_notices_user_id_notice_pk" PRIMARY KEY("user_id","notice")
);
--> statement-breakpoint
ALTER TABLE "account_notices" ADD CONSTRAINT "account_notices_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;