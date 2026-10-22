-- public.outbox_messages definition

-- Drop table

-- DROP TABLE public.outbox_messages;

CREATE TABLE public.outbox_messages (
	id uuid NOT NULL,
	aggregate_type varchar(255) NOT NULL,
	aggregate_id uuid NOT NULL,
	event_type varchar(255) NOT NULL,
	payload jsonb NOT NULL,
	status varchar(50) DEFAULT 'PENDING'::character varying NOT NULL,
	created_at timestamptz DEFAULT now() NOT NULL,
	processed_at timestamptz NULL,
	CONSTRAINT outbox_messages_pkey PRIMARY KEY (id)
);


-- public.transactions definition

-- Drop table

-- DROP TABLE public.transactions;

CREATE TABLE public.transactions (
	id uuid NOT NULL,
	provider_id varchar(100) NOT NULL,
	external_transaction_id varchar(100) NOT NULL,
	wallet_id uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	amount numeric(18, 2) NOT NULL,
	status varchar(50) NOT NULL,
	created_at timestamp DEFAULT now() NOT NULL,
	updated_at timestamp DEFAULT now() NOT NULL,
	CONSTRAINT transactions_pkey PRIMARY KEY (id),
	CONSTRAINT uk_provider_external_tx UNIQUE (provider_id, external_transaction_id)
);


-- public.wallet_ledger definition

-- Drop table

-- DROP TABLE public.wallet_ledger;

CREATE TABLE public.wallet_ledger (
	id uuid NOT NULL,
	wallet_id uuid NOT NULL,
	transaction_id uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	amount numeric(18, 2) NOT NULL,
	balance_before numeric(18, 2) NOT NULL,
	balance_after numeric(18, 2) NOT NULL,
	created_at timestamp DEFAULT now() NOT NULL,
	CONSTRAINT wallet_ledger_pkey PRIMARY KEY (id)
);
CREATE INDEX idx_wallet_ledger_wallet_id ON public.wallet_ledger USING btree (wallet_id);


-- public.wallets definition

-- Drop table

-- DROP TABLE public.wallets;

CREATE TABLE public.wallets (
	id uuid NOT NULL,
	user_id varchar(255) NOT NULL,
	balance numeric(18, 2) NOT NULL,
	currency varchar(3) NOT NULL,
	"version" int4 NOT NULL,
	created_at timestamp DEFAULT now() NOT NULL,
	updated_at timestamp DEFAULT now() NOT NULL,
	CONSTRAINT wallets_balance_check CHECK ((balance >= (0)::numeric)),
	CONSTRAINT wallets_pkey PRIMARY KEY (id)
);
