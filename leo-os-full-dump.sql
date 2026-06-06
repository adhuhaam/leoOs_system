--
-- PostgreSQL database dump
--

\restrict UICTje6xlWPue3ZGeqJ5Cmmpt3FHSP1OAnfVLl6tLBWt7ora5Qkh85nhSap6ra4

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: app_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_settings (
    id integer DEFAULT 1 NOT NULL,
    app_name text DEFAULT 'LEO OS'::text NOT NULL,
    accent_hue integer DEFAULT 162 NOT NULL,
    password_hash text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    company_name text,
    company_address text,
    company_phone text,
    company_email text,
    company_website text,
    company_registration_number text,
    logo_image text,
    extension_token text,
    openai_api_key text
);


--
-- Name: billing_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_documents (
    id integer NOT NULL,
    kind text NOT NULL,
    number text NOT NULL,
    company_id integer NOT NULL,
    customer_name text NOT NULL,
    customer_address text,
    customer_tin text,
    issue_date date NOT NULL,
    due_date date,
    terms text,
    gst_rate numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    gst_inclusive boolean DEFAULT true NOT NULL,
    notes text,
    status text DEFAULT 'draft'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    client_id integer
);


--
-- Name: billing_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.billing_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: billing_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.billing_documents_id_seq OWNED BY public.billing_documents.id;


--
-- Name: billing_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_items (
    id integer NOT NULL,
    document_id integer NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    description text NOT NULL,
    detail text,
    qty numeric(14,4) DEFAULT '1'::numeric NOT NULL,
    rate numeric(14,4) DEFAULT '0'::numeric NOT NULL,
    amount numeric(14,2) DEFAULT '0'::numeric NOT NULL
);


--
-- Name: billing_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.billing_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: billing_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.billing_items_id_seq OWNED BY public.billing_items.id;


--
-- Name: clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clients (
    id integer NOT NULL,
    name text NOT NULL,
    contact_person text,
    phone text,
    email text,
    address text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tin text
);


--
-- Name: clients_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.clients_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: clients_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.clients_id_seq OWNED BY public.clients.id;


--
-- Name: companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.companies (
    id integer NOT NULL,
    name text NOT NULL,
    address text,
    email text,
    country text,
    registration_number text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    letterhead_image text,
    signature_image text,
    phone text,
    signatory_name text,
    signatory_designation text
);


--
-- Name: companies_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.companies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: companies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.companies_id_seq OWNED BY public.companies.id;


--
-- Name: expense_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expense_categories (
    id integer NOT NULL,
    name text NOT NULL,
    color text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: expense_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.expense_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: expense_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.expense_categories_id_seq OWNED BY public.expense_categories.id;


--
-- Name: expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expenses (
    id integer NOT NULL,
    category_id integer NOT NULL,
    amount numeric(14,2) NOT NULL,
    expense_date date,
    remarks text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: expenses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.expenses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: expenses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.expenses_id_seq OWNED BY public.expenses.id;


--
-- Name: loa_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loa_entries (
    id integer NOT NULL,
    company_id integer,
    passport_id integer,
    company_name text,
    company_address text,
    company_email text,
    company_country text,
    company_registration_number text,
    candidate_name text,
    candidate_address text,
    candidate_nationality text,
    candidate_date_of_birth text,
    candidate_passport_number text,
    candidate_emergency_contact text,
    job_title text,
    work_type text,
    basic_salary text,
    salary_payment_date text,
    work_site text,
    date_of_commence text,
    job_description text,
    working_hours text,
    work_status text,
    contract_duration text,
    signatory_name text,
    signatory_designation text,
    signature_date text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    company_phone text
);


--
-- Name: loa_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.loa_entries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: loa_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.loa_entries_id_seq OWNED BY public.loa_entries.id;


--
-- Name: loa_options; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loa_options (
    id integer NOT NULL,
    category text NOT NULL,
    value text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    company_id integer NOT NULL
);


--
-- Name: loa_options_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.loa_options_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: loa_options_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.loa_options_id_seq OWNED BY public.loa_options.id;


--
-- Name: passports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.passports (
    id integer NOT NULL,
    full_name text,
    passport_number text,
    date_of_birth text,
    date_of_issue text,
    date_of_expiry text,
    address text,
    nationality text,
    status text DEFAULT 'processing'::text NOT NULL,
    error_message text,
    original_filename text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    client_id integer,
    work_permit_number text,
    agent text,
    company_id integer,
    submitted boolean DEFAULT false NOT NULL
);


--
-- Name: passports_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.passports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: passports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.passports_id_seq OWNED BY public.passports.id;


--
-- Name: passwords; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.passwords (
    id integer NOT NULL,
    website text NOT NULL,
    owner text NOT NULL,
    username text NOT NULL,
    password text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: passwords_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.passwords_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: passwords_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.passwords_id_seq OWNED BY public.passwords.id;


--
-- Name: push_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_tokens (
    token text NOT NULL,
    platform text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tasks (
    id integer NOT NULL,
    title text NOT NULL,
    notes text,
    status text DEFAULT 'todo'::text NOT NULL,
    priority text DEFAULT 'medium'::text NOT NULL,
    due_date date,
    parent_id integer,
    "position" integer DEFAULT 0 NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tasks_id_seq OWNED BY public.tasks.id;


--
-- Name: billing_documents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_documents ALTER COLUMN id SET DEFAULT nextval('public.billing_documents_id_seq'::regclass);


--
-- Name: billing_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_items ALTER COLUMN id SET DEFAULT nextval('public.billing_items_id_seq'::regclass);


--
-- Name: clients id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients ALTER COLUMN id SET DEFAULT nextval('public.clients_id_seq'::regclass);


--
-- Name: companies id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies ALTER COLUMN id SET DEFAULT nextval('public.companies_id_seq'::regclass);


--
-- Name: expense_categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_categories ALTER COLUMN id SET DEFAULT nextval('public.expense_categories_id_seq'::regclass);


--
-- Name: expenses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses ALTER COLUMN id SET DEFAULT nextval('public.expenses_id_seq'::regclass);


--
-- Name: loa_entries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loa_entries ALTER COLUMN id SET DEFAULT nextval('public.loa_entries_id_seq'::regclass);


--
-- Name: loa_options id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loa_options ALTER COLUMN id SET DEFAULT nextval('public.loa_options_id_seq'::regclass);


--
-- Name: passports id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.passports ALTER COLUMN id SET DEFAULT nextval('public.passports_id_seq'::regclass);


--
-- Name: passwords id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.passwords ALTER COLUMN id SET DEFAULT nextval('public.passwords_id_seq'::regclass);


--
-- Name: tasks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks ALTER COLUMN id SET DEFAULT nextval('public.tasks_id_seq'::regclass);


--
-- Data for Name: app_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.app_settings (id, app_name, accent_hue, password_hash, updated_at, company_name, company_address, company_phone, company_email, company_website, company_registration_number, logo_image, extension_token, openai_api_key) FROM stdin;
1	LEO OS	162	\N	2026-06-06 09:09:05.739+00	\N	H. Reethi noo\nvaijehey magu	+9609320410	info@leoemployment.com	https://leoemployment.com/	\N	data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAtwAAACzCAYAAAC6lMvPAAAABGdBTUEAALGPC/xhBQAACklpQ0NQc1JHQiBJRUM2MTk2Ni0yLjEAAEiJnVN3WJP3Fj7f92UPVkLY8LGXbIEAIiOsCMgQWaIQkgBhhBASQMWFiApWFBURnEhVxILVCkidiOKgKLhnQYqIWotVXDjuH9yntX167+3t+9f7vOec5/zOec8PgBESJpHmomoAOVKFPDrYH49PSMTJvYACFUjgBCAQ5svCZwXFAADwA3l4fnSwP/wBr28AAgBw1S4kEsfh/4O6UCZXACCRAOAiEucLAZBSAMguVMgUAMgYALBTs2QKAJQAAGx5fEIiAKoNAOz0ST4FANipk9wXANiiHKkIAI0BAJkoRyQCQLsAYFWBUiwCwMIAoKxAIi4EwK4BgFm2MkcCgL0FAHaOWJAPQGAAgJlCLMwAIDgCAEMeE80DIEwDoDDSv+CpX3CFuEgBAMDLlc2XS9IzFLiV0Bp38vDg4iHiwmyxQmEXKRBmCeQinJebIxNI5wNMzgwAABr50cH+OD+Q5+bk4eZm52zv9MWi/mvwbyI+IfHf/ryMAgQAEE7P79pf5eXWA3DHAbB1v2upWwDaVgBo3/ldM9sJoFoK0Hr5i3k4/EAenqFQyDwdHAoLC+0lYqG9MOOLPv8z4W/gi372/EAe/tt68ABxmkCZrcCjg/1xYW52rlKO58sEQjFu9+cj/seFf/2OKdHiNLFcLBWK8ViJuFAiTcd5uVKRRCHJleIS6X8y8R+W/QmTdw0ArIZPwE62B7XLbMB+7gECiw5Y0nYAQH7zLYwaC5EAEGc0Mnn3AACTv/mPQCsBAM2XpOMAALzoGFyolBdMxggAAESggSqwQQcMwRSswA6cwR28wBcCYQZEQAwkwDwQQgbkgBwKoRiWQRlUwDrYBLWwAxqgEZrhELTBMTgN5+ASXIHrcBcGYBiewhi8hgkEQcgIE2EhOogRYo7YIs4IF5mOBCJhSDSSgKQg6YgUUSLFyHKkAqlCapFdSCPyLXIUOY1cQPqQ28ggMor8irxHMZSBslED1AJ1QLmoHxqKxqBz0XQ0D12AlqJr0Rq0Hj2AtqKn0UvodXQAfYqOY4DRMQ5mjNlhXIyHRWCJWBomxxZj5Vg1Vo81Yx1YN3YVG8CeYe8IJAKLgBPsCF6EEMJsgpCQR1hMWEOoJewjtBK6CFcJg4Qxwicik6hPtCV6EvnEeGI6sZBYRqwm7iEeIZ4lXicOE1+TSCQOyZLkTgohJZAySQtJa0jbSC2kU6Q+0hBpnEwm65Btyd7kCLKArCCXkbeQD5BPkvvJw+S3FDrFiOJMCaIkUqSUEko1ZT/lBKWfMkKZoKpRzame1AiqiDqfWkltoHZQL1OHqRM0dZolzZsWQ8ukLaPV0JppZ2n3aC/pdLoJ3YMeRZfQl9Jr6Afp5+mD9HcMDYYNg8dIYigZaxl7GacYtxkvmUymBdOXmchUMNcyG5lnmA+Yb1VYKvYqfBWRyhKVOpVWlX6V56pUVXNVP9V5qgtUq1UPq15WfaZGVbNQ46kJ1Bar1akdVbupNq7OUndSj1DPUV+jvl/9gvpjDbKGhUaghkijVGO3xhmNIRbGMmXxWELWclYD6yxrmE1iW7L57Ex2Bfsbdi97TFNDc6pmrGaRZp3mcc0BDsax4PA52ZxKziHODc57LQMtPy2x1mqtZq1+rTfaetq+2mLtcu0W7eva73VwnUCdLJ31Om0693UJuja6UbqFutt1z+o+02PreekJ9cr1Dund0Uf1bfSj9Rfq79bv0R83MDQINpAZbDE4Y/DMkGPoa5hpuNHwhOGoEctoupHEaKPRSaMnuCbuh2fjNXgXPmasbxxirDTeZdxrPGFiaTLbpMSkxeS+Kc2Ua5pmutG003TMzMgs3KzYrMnsjjnVnGueYb7ZvNv8jYWlRZzFSos2i8eW2pZ8ywWWTZb3rJhWPlZ5VvVW16xJ1lzrLOtt1ldsUBtXmwybOpvLtqitm63Edptt3xTiFI8p0in1U27aMez87ArsmuwG7Tn2YfYl9m32zx3MHBId1jt0O3xydHXMdmxwvOuk4TTDqcSpw+lXZxtnoXOd8zUXpkuQyxKXdpcXU22niqdun3rLleUa7rrStdP1o5u7m9yt2W3U3cw9xX2r+00umxvJXcM970H08PdY4nHM452nm6fC85DnL152Xlle+70eT7OcJp7WMG3I28Rb4L3Le2A6Pj1l+s7pAz7GPgKfep+Hvqa+It89viN+1n6Zfgf8nvs7+sv9j/i/4XnyFvFOBWABwQHlAb2BGoGzA2sDHwSZBKUHNQWNBbsGLww+FUIMCQ1ZH3KTb8AX8hv5YzPcZyya0RXKCJ0VWhv6MMwmTB7WEY6GzwjfEH5vpvlM6cy2CIjgR2yIuB9pGZkX+X0UKSoyqi7qUbRTdHF09yzWrORZ+2e9jvGPqYy5O9tqtnJ2Z6xqbFJsY+ybuIC4qriBeIf4RfGXEnQTJAntieTE2MQ9ieNzAudsmjOc5JpUlnRjruXcorkX5unOy553PFk1WZB8OIWYEpeyP+WDIEJQLxhP5aduTR0T8oSbhU9FvqKNolGxt7hKPJLmnVaV9jjdO31D+miGT0Z1xjMJT1IreZEZkrkj801WRNberM/ZcdktOZSclJyjUg1plrQr1zC3KLdPZisrkw3keeZtyhuTh8r35CP5c/PbFWyFTNGjtFKuUA4WTC+oK3hbGFt4uEi9SFrUM99m/ur5IwuCFny9kLBQuLCz2Lh4WfHgIr9FuxYji1MXdy4xXVK6ZHhp8NJ9y2jLspb9UOJYUlXyannc8o5Sg9KlpUMrglc0lamUycturvRauWMVYZVkVe9ql9VbVn8qF5VfrHCsqK74sEa45uJXTl/VfPV5bdra3kq3yu3rSOuk626s91m/r0q9akHV0IbwDa0b8Y3lG19tSt50oXpq9Y7NtM3KzQM1YTXtW8y2rNvyoTaj9nqdf13LVv2tq7e+2Sba1r/dd3vzDoMdFTve75TsvLUreFdrvUV99W7S7oLdjxpiG7q/5n7duEd3T8Wej3ulewf2Re/ranRvbNyvv7+yCW1SNo0eSDpw5ZuAb9qb7Zp3tXBaKg7CQeXBJ9+mfHvjUOihzsPcw83fmX+39QjrSHkr0jq/dawto22gPaG97+iMo50dXh1Hvrf/fu8x42N1xzWPV56gnSg98fnkgpPjp2Snnp1OPz3Umdx590z8mWtdUV29Z0PPnj8XdO5Mt1/3yfPe549d8Lxw9CL3Ytslt0utPa49R35w/eFIr1tv62X3y+1XPK509E3rO9Hv03/6asDVc9f41y5dn3m978bsG7duJt0cuCW69fh29u0XdwruTNxdeo94r/y+2v3qB/oP6n+0/rFlwG3g+GDAYM/DWQ/vDgmHnv6U/9OH4dJHzEfVI0YjjY+dHx8bDRq98mTOk+GnsqcTz8p+Vv9563Or59/94vtLz1j82PAL+YvPv655qfNy76uprzrHI8cfvM55PfGm/K3O233vuO+638e9H5ko/ED+UPPR+mPHp9BP9z7nfP78L/eE8/stRzjPAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAAJcEhZcwAALiMAAC4jAXilP3YAALmHSURBVHic7J13nCRHeb+f963unrDhdi+fckACJFAgiiyByMZgwMbGYKIxYPMzySZjcgabbKLJUWAQ0YBACBRAgEAgAZJAOZ/ubu82zEx31fv7o2c2zuzOzO7e7Un96NNw29NdVZ3feuut7ytmRkFBQUFBQUFBQUHB6qD7ugEFBQUFBQUFBQUFt2YKg7ugoKCgoKCgoKBgFSkM7oKCgoKCgoKCgoJVpDC4CwoKCgoKCgoKClaRwuAuKCgoKCgoKCgoWEUKg7ugoKCgoKCgoKBgFSkM7oKCgoKCgoKCgoJVpDC4CwoKCgoKCgoKClaRwuAuKCgoKCgoKCgoWEUKg7ugoKCgoKCgoKBgFSkM7oKCgoKCgoKCgoJVpDC4CwoKCgoKCgoKClaRwuAuKCgoKCgoKCgoWEWivVHJBRecRrkMZnujtv4QEcbH6+wZryMi+7o5AFgwBgcrbFg/jK2tkxcJnAHceV835FaO3zNRu0cIdvlqFJ4kEVdccT2vfe3HMTNClqEhoEmCIJgAZkzVasQuIo4cN+/YwcDAAJOTUwwNDZLEMWO79+CcoqKkWcbo6AghBAAcsGvnTjRJGBoawkJAmrdyAARDDIJI8x43VB2YYYCqsmvnTkyF9SOjmA+k5nHiEhEbFGRIRCqNRsPt2j0WjYyOxrt27cpGh9fV4zhuWLAGYuOGjt140w1h88ZNiCrX33gDWzdtJpgRRY7JqSlKcYIDgijqlB23bKdSrVKuVEDgphtvYsOGDWCGigMxQjBEFWcG0jxnIWBpxk27x9iwfj1OFenTtzFZnyKJEyKnYIJh+TnzHtMIFnlXWQA0NOs2DCMA9XqdJIqJXYQ3j1nAW+59cS5CEXzIyLIMnMM5h5vdfgvA4u8ja6RUjzmSdfe+C5ZmfR37UlgI+f0kgjjXRwHNQ5m1wszP2URUEe3+2rXa1M++izXUQv6NQpg+9fnjElCn+CyAgOjc+2GlvmWCkPkGU7Ux8kbMpVJeh2oEITR/ntlGRAjBUDd3PQZpViNyMZlPieMSaVondmUyX8f7lHIyOPPtc0sfi5kxObVz3vdSKMVDiMy9FqqCukWuj4F5n5/Xru8vIYSMyaldc9ZVK+sW1N/vtZlzjzm3avbK9Dlslt9NLfMen3ynNqd4sbJm17saR7YattQ3/u11XW23VwzuOHIPVWHY1oYd2xZBSJL4loGK/HCN2NsYebtC86OyxhhtLgWrSx+WRJcFO8f3v38+U1N1KtXyalWzHJyZHZgkyeEmHIHZsQhHROgGhBFBRoARMxuM41g3bdgIwKb1GwCCmdURaiBjgu1YPzK6U0SuBX5fKZf/CFwJXA7sXGMd2oKCgoKCWxl7xeCuVkofNuOQvVFX/xhDA8mFw4Mcv4TzZu8huRcjrE1jYHXcVgWzyVjKldgnSRJx+eXXce65v6NUSlajin5YB9wROAm4l4qcAGwaGBgYhRnPRJedTwUqzWUUOKxUKk2XsX5kFDPLBG4G/pjE8fki8ivMfgH8mdxgX8ljKygoKCi4DbNXDG4zG98b9SwXM5tYU9/YtdSWglsVUeT47nd/xsREjWq1tC+bciTwYEEepionQrNjPsuoXinDd3Y5zX9HAtswtiVxcnJzXU2MXwv8NI7jM1T1fOCWFWlAZyrA4UCZmadegD8Ak82/DwM2AFc02yPknZMKUCOP0Kk0//9ioDGr/DsDU8BlMOe1ckdgArhq1rYDwB1m1dNqy5HAcPPftzR/74yxtmMICwoKCvYye8XgLigoWDskScyf/3wd5577WyqVfeLdPhp4qCKPQuQkhKF9HTA1yxgvi3CSmZ20bt3Ii83sGjM7Q0T+V0TOAnb2VYEsGrd4ssH7zexsZkKIBHiZOneDirxVkMMNG1PhQDP5airyAcWeLrBVkNshDJnZL5v7PR/jFpBRQT4IlAQGQC4E+/dYNajqfwFHqWgVkf/13r8HOElF3mZm1zp1RwUNb89C+GLsotsLfCFgFwMOkZ8C7130fDqldMgB07GmBQUFBbd1CoO7oOA2hnOO7373PCYn63vFu21mmFmJ3JP9VISHkXtS1zRNI/wgQZ5C4Ckb12+4VlS+EXz4LHA2PY1B5TMyOjBi2G8C9uTZKwUoxfHj1Dg2y/yp4gRnHCEiHzf4prfwYhVF4F8Vjg3YsyAPQUsbKZFzf5FE8VQI9kQxGxTVnzjjhCiKBk3lhGDhId77zXEUf8eJfVVEnorZRwP2KRF5aBwnr1cLX0TkHoRwrok8BwwTYbHpTBaMoRPvSOnALVjm1+L8k4KCgoK9TmFwFxTchkiSmMsvv5bzzvsd5XK86vUFs80DA4NPlij6BzGO25+DDJy6Aw17tnPu2cB5ZnwK7IvAjm72D2Zoe+MzAEGZZciaIeYJEu0ysS2IPVxEzyXYn33wJzvn4tkhMoLgRPAW8N4TLGDo/wazL2AWwHaDTeZKF+6BZnamQcOpu8aMi5zqfQP2IvPZRFDBibsCSDWfSHJHU13vjLchcpO38AGbCXWZg4WAG6gwdKejsbA/X+2CgoKClaXQ4S4ouA3hnDa92zV0RSTLOrJZ4BWI/iopl98RR9Fx+/skRJvr0D5JRD4QOfcrhVcZHLzk/p0Pf1KR+wjyOeALwJcR3uYxxcIZIrw1ctFLFfmxqXzD0EeaWTpr/2khNidKpA6XyyyONxqN1EJARV8MMhawC4B1BplBS6psF1hZzCZMwEycou8l+K8ZRhB2huAv94QzQwh3U5EPq5mqGQsW70mGhzCRIoa7oKCgYBaFh7ug4DZCS5nkvPMuolRa+VCSZujIiCDPUeTZNCdA7u+G9hIcKiKvQ+R5mH2MPLb5uvabGvVGSilZEDdfMuwij72ePIZbQghTwXsrR25zMD4j2GfE7FBReUDk9N0B22Vw9vxzK0CsDo1jammKAUkUvwaRB2Lh70S0FdsSBGkFupSBkOujy4ZI9Qtm4RIJ4R0iYOLelusoCz74M2KJLjDYAly/4Ah9oHzwVjRyhEY6/+eCgoKC2yyFh7ug4DZCFDm+853zmJiYQnXl4mrNjBAC1Wr1icODg+dj9iZY6zKgK84mRF4qyC8ReYXB+nZynmG+nzwnMrhJ4PeK/E6R30biLlPEMrOXhmCvC8FA5co0858y7DcOOabdFTSbCSw3M0px/CYHd7IQHgB6rYQA2MVYOMpnGYiBcIwhvxezDSLuyyH475jZP5uLDAQVebU6d4SK4KJoFCGIWV3MmL3QSIlHhykfeuCqJbspKCgo2F8pPNwFBbcBWsokeez2yimTmBnlcumuTvT1kXMPx7lbu0d7KbaK6Bs0Sf5haGDwNWb2+YWbGC3vcpMgyD0FeS6t8BBBY+e+7kU+7FS+iMlBZlygKscAVe/5ms24SxJySUDI3+l/IyKnV8rlv3CiLwshPF9EnwWUzOybjUb6v3GcPMs5eaeabAL7I9gvcHoaIts0uJ0i8s9Aas59DHAKXxLkS4I9woJ8xnDTcesChMwTDQ0z+sCT0FKSZ+grKCgoKJimMLgLCm4DzI7drq5cVslYRF46UKm+FKjexg3tOYjI0esGhz6X+ezvROQVwG9hRqck9X522u+fCXzQ8sQ/00VkIUQi9gen0akIfxPM1jl1vwwWXgKyO8syggVU9fu46Jez9h0U1UjgumD2IhMpGVYFJDMfB+Nm4DGi+vdmdjnwEQnBTPWbweynImwJmAI1gdiH8B8O+ZkJJ6jZuww5fbbiSvABNzTA6KknEY0OFd7tgoKCgjYUBndBwa2cXJmk5d1emdhtFbljOSm9F3hQYWi3p2kMPwo42bBXAe+GXFFkqlajXCm1Ji1eafD2+fv7EHC5UX6zwfttXjhKCAEfPMAF5qZ/yYAPNw3isww7a36ZzUKuMeyteXuAPP7+f0zmax3mhrXBt8G+veAgzUCE0QfchXj9cLu47a3A8TRT4XQ8Wb0TAdcCF85adyfyyavdWPyuuf9vl9juTsBBQDcuewfcAPx63noB7gtUyRVpekGAXc3lRmA33Z/HUeBuzTI67eOAn9GvvvzSbADuKcIdgEOBzc0668C1qu4q4FfABc11c7DmfwIbQU4iT+jU6ViE/Nr/GMwvqnyfcwRwe9rfLxH5+f5Vs93HdNhuPgrsFuTcuc1qW/fRdHdfKTBOLkU6n7uQn9OVHFJqNfhXwPbmvxPgXkCJ9udfyRNwndXh99l0OnYhfz5+BuwB4madrYReK4EDLgf+uELl9URhcBcU3MpxTpux28vX3fY+UCmVn1kpld8iyIa2Eclrl1vIU7lfj7HLsGtE5G7kL/XVZEiQ/1KRU0BeQP7CR3NbdcW+JPsCyzIqRxxMsmUDlqa0UT18gOTKKyuP6JcR/RuZSSr0EuBJ3e/PRZ5wIjDdS1DnZptHTkQ+Ady1hzZ9E9FH5cVPt0uBz9KFkk2HQr0oNXIpxj8hnGPGV4Bz5m5n8zXPjxX4XhcVnAz8eNEWCKRZrdW/6qbN9xXhWSI8BNjSVotdIHIJYCEW/T3wRRH5JHAVIqS+TlZLwQIiTqrVkfdJbvx2RFWJo/LfNNLal2fqbNvgWFW/KHmHpM3xCrXGxFMx/VWSVP5asAUd4vYYTtyOannkWLAbZsqbb2rZOwT+qrsyAfgzcDvAQCHvqCPwZoGH9FBO9wgPB77b/GtU4CvkHaiOmNiTQ7DPzNbp14Xn/+8FXtehiIBwV/JO66DA54ED+mh9Z4R3AS9a0TK7pJg0WVBwKyZJopWM3S6Njoy8T1U/oqr7g7F9lVn4vMFTMe5t2PEBOxZ4IPBY4COs9Mt8EUR4dClJfgI8tDUqoLJYCpk1joFEjoE7HbGYBOBq3iTz+yq91nUHEe7QMoylWYKZtJZDgDsvs039tm02jjxR1CbgJOCFIvxEhK8g3H664rDgMnRb5xLbCZlPybJGN0mMNovIx1X5sQhPJlezWapqFZFjBXldHJV+ifA8oCkfb8RRhTgq32whLGkkmRlJXHllOVlXKsXD5MtQayRpGlV5rEh7Y7tZzrlOk886F/cubymsN+TuwYTWkvk6WVbLF18fFOHE3grteI1Ws78+v84l61KVt5mFLamvk/k6aVbH+wUDA4ud0DDv99U4vn324SoM7oKCWzEzWSVrfSuTmBkGB6q6b1TK5X9e4SauOCL6g/HxiUfvGd9zog/hicAnVfVcEbkWs5AredhxIvJdlvCYrXjb4EDgG0kc/7/WOhXBNVPeiMh+k5kxZBnlww4k2bweyzqOaK/mx21+2b3W5VQ4WSW/Blig1thDrbGbWn2MzE/dT0R67aXuLcNIRXisqp4JnAJNhZpVSDYkAo3G1JKToQVOVNWfisjT6N+22Cgi73HqPi3iBoMFUl8nzaaYrO36Sgj++0t1UUXkOFV9YutZavM8Jc7JSxYpIljgVSpxpuKgj3tYVR7iVGktIWT45hJCdmd6f++sRkeuV7q4h2WbOt6eZhM0snEa6R7StDb/GixlcPdYZ8/sM4O7CCkpKLiV0vJu/+xn/cdumxlxHN8tdtHnTOSotZrMRESwYGeZ8UZRvhdCIJhHVXHOsXtsN4HA8MAAht1JRL7BEt5taSaPMbhGYIJ8GQfGzUgF1hu2AbMhUV0HbKOLwFEgrpRL7w7BjgBeAJg0s0xOTk0SRRFxHK8p4ztPkiNN91N+D0isVI8+ZNEA4bWNYPCAejrxXgDMiFyCoBhG5OL77AfzE7YCpwGniHBhSy99pRARvE9JF/FuN++H40XkO2BLeLS7wXAuelK1PDRSb0w+IViYVI1xGoHpvwPnkmvHd8Q5eUXwchp5LDDeZjqEqvpXIB09zD74b2ZZdoaKy+vsAxHuk/kshjxB1bRUJ0bsSvcTEdkP7q0+MCIXP6mcDHxmqr7neyKCDw1CCGvmXbYvKQzugoJbKTPe7TqVSn8GtyAPKMXJacDGtWpsG2Q+bbxZXfQGkEZrvXMRwYzrrr+OK6+6ioMPOoiRoaFjg/EN2uiENw3sFDhLVc/dObbrZ+VS6Y9xklwOki38XAgheHyaalIqrw/YIWZ2lFO5qxn3EpG7MiPXN7fNBiLyr2DDwD8BKQKNRoOJiQlKpRKqSlAljuJ9GnYyOyOpzQqLDamndt2NlA/cvG8atmwMQe4VaWkY2G0W8H46nNvFUXzfxecbrhnWa6QfJrP7Alkrm9FKYAb1dIrc0ajMPxcGRJqMOnVfYMnwkV7qNZxL/qJaSd6fZdnTzCSf7xDCrxH+W1Wev0QRR4ryTDP7TwAVbV3KqnPy6k47iUg9zWqvqTcmqSRDCDF9Xv87Z752hFn4IwjOJU2D0xDR/aEj1zdmJlGUvLtsQ/eQZoenh+D/WzWFwV1QcCtkdux2qdRH7LaBwMNR/RwwstLt65MLyJUXDmutUNXdIYQn1huNb1Ur0cynUYSxsTGuvPoqJiYmmqvkQFH3Dbw/bHahTc/L1fVG44tRFH1WJFeZaKQpSRx3064gItsx2w78ysy+mHrPnrHdR27csOHkYPY4ETmFtl45eRq5ZN9TgHrLC1Svzwg2mEG1Wt3rHqKl6tPIMXnplQwcfRjRYBXze336ZzITXtCfASMi21TjuxicKQbOlVpC6MeIcOR+YGwDIHBPVXm0wVdWss1mAQuGdvD0CkapNPAuVb3DyhuRBvBUUf0xxie8r9NIJ1CN3jhQWfd4cvWYjqjKv0/VJz6dprXtpXiA2FVA7YnkiiNtCWb/E0eVC2JXRnAthZR+iErJ4P0t2B9hTlzEelU5qb8i9zp9hxyL6B3iqPwy78PLEcnt7T6L6rcNa5HC4C4ouBXiXDTt3e5LmUT4KxH5NPlkrTWBmX0P4eGzYjj9nj27n5Vl/lvOadNDnXvHKqUSjThiy4YN6KZNYKYDQ8MfCiEcPrtMEZkYn5h4T6T6nx672Tk3bWjONzhbfy8wLESoNxq4yM1ZnWXZn0T4U5amHxPV41Td36rIk5lnKAjyBIRx4Jnz6wKYmJyg3qgzMDBAOY5zT5EIqzLdspdJnCKEqTrjf7ickXscB/0b3DWMS8llwrqrXhCzcJkPPo+B73PoHxBVHmhmZyLNOOhc9eTuICujodk9N2Fcy2xDR9hElxN7RXgmxldyb/DKGL+CUE6GaH9ZDIQHqMo/dGlsX2vGFzEuQ7i9CE9iCdULAKfyhmB2umppR+4ktu0hhNeq6kcW3dHY6jR6UT34lzXbVxFZVJ1ilwV7s5iwQtPbTrZ8YjbT02eE48ll/PYexg3AdeSTb3vYjbE2yjddIyovNu+/Wm9M/kJFKJeHei1LyOUIV5quvCirQWFwFxTcysh1t6/lvPN+R6XS1/vqoSLyOZaIk9ybBAtvJoSXo+5YEY5TVcYnJt590R/+8EUz4/BDD2VwYBBBCBZwScTGrVun91d4jBmPnG0YmNmPRfSF9Ub9V+YiXLL4e3hycoKJqRob1q/Hmj4rEUXiiJtvvpkNo+splUpYro09JxQDuNCwC3eOjb2zWi7/XblceaaZHT/r92eIcJOZvbzNvoQQGB8fpxZFlJI8zjjYysVFeue6MbYXuJMlckz96WoG73A40UAVC30Z3ZcG457YQh3mjg0RkTRrWK2xm3IyQCTxcjKcngImGGZNIXJ1PLDfwvrFjI9b4GXMsvbEscFCuI+qvoelZAWFO4ONygpqame+QebTjp27JC7/27RG3SKY2c/MeCwq1xHyPqMFPizK6cCRS+x+oBhPM7N3qjjq6QSNrPaJann4GarRSZ08+oYRR6VnV0rrPiQSXYHY35PrgXdoI++xEK7K/5IFyia9IsL9VXRAYCJrxpAr3Gdvh1YYfMACr6e3XoT4kD/MLurP6BaIndN3q9f7Y3izgGrUfMiWaLMZFsIeEf1bkPnfoUyFlyP5ZOGOZQReZsYvkDl2rpjZ5fsqpKcwuAsKbmXMZJXs3bstIvdS0c+zhoxt4OKAvT5SByI3AfgQbr7iyiveZpZ/DK665hpu3r6d2x91e1DBguVJXnJcJPri2R+NEMLntu/c8aytm7ZMaIfJia2Xcsg8u8fGyLKUtIMKhDSNVQFMBOcc69evJ2QeddH0NlmW3eK9f5+YfdiH8Jci8mwRuT8QK/KygcrApduntv/Pjp072/sUm20yM6IoYsuWLZTLy7xU0lYrdz4RJqcInMEcC0ex1EOaLWfw10QtsyChp2gIM1QcSVxZytj25JNd17X7UUSOB3cgwjVqBthAM8nKfGrNslZn1EcsiAPzMrvXcjPwNTNUhK8sUcJGEdkC7FwJyU4RIZjHB9/WRlR1x4hqNxrQuw17iohcNz35NmQ00smLVd2/lJKBb8+aHdCuJZiEf6jV97zbIFONUHEZpv8G/IjF7ZiROCq9wAd7gWgn77Zg5q+dqk/+F7kiE6WoiorQxXncRYeQOxHZ1vBTx4WQnZtElea6tucrBaaA4aUq6wvBi4KF3hU/VLXvTr1hqLp7V8rDzzUf3psPThhgtaVeFvloZUiBMxc2Ckz4+yVbpfYTgpw9/xLmo6DdH8dKUsgCFhTciojjmEsvvZrzzruIcrmHkTMzRPVOLk6+Qh4nvSYQoJGlL0/TbCr/+Nl1qkqtNvXeyampG6Mowrl8pLRWrzM+NYFZIISZBbM7icg9oGVE2DsNnuxDmOhUb67nm+STrYIRsgzp/PEp0Wa4VlWx5v+Laq4pHMet9jaA00w4leDvaSG8OZj9caBa/WDw/qTdY2OMtVl2797N7t272bNnDzt37uTKK68kTdM57ermA2nTi+XepKWWEO4B9nDDQiv7X+u/pp7hknUu0ZwgCuK6WHRmtyQuo7rkSLlY3lGodfh9yMzuGULIPfRmR+fx2wsa+XPy7JSrRR4+rjNLLvOnWOAilg7OLgGDK9UYs4BZoNUhnSuzJziN/lJEFn3JiAiZT0+v1cb/OFXbQ5pOtQpHxSHo98zsN0u0BBU9tlIaOrFSGqIUDxC5MiHYT83C55c6DlH+3jn5IHT2bgezN2F+JxIQyTvx3XRamplcb2n7m5lTdffP498FkM0i0i5+/HcGlyxZWf8Y0t2zheTXvBVKshKKN4K91swfnmV1sAAz2SsX309loWUs06+abpzFZdH+g8dXg8LDXVBwKyJJIn7960sZH59kYKCtQMYCQgio2cbYRV8il7ZbE6gqU7XaN3538UVf37x5M4cddhjB+1uyNJu85ZZbPjQyPDxj6JlRqVYZHhwkBCNqBk0aoCIPA5yZ2VS99u8uit4RSWefrpGfk+HBIcwCPs3IJ/4YzVHWrYI8EDhFVe4kuM2bNmzwTt2Eme0Gdgnya/JUzL8yY3seH2wMDAwQaUStXieYUSqXEbMLRPWC3ZMTb5RgD9uyefNdNw0M/JJZGRCn29b06Le0MxpZludDzjxRFOG9Z6pRo1qpEOZnQTFDEFzksLQxrTnRjbNHovjZIlJr7xla9hfNAUPkBvFShRlCHcWcJTjVbkJJFOOXzfjZ9uELwilmfEXFIcr92tdsP0Tkb5aqbBn4Zlum/691vREex9LnZo+taIp2oRQPLFbr/ZY69/nvenoU5aMwIvn1UheR5CM/AfghcMISjXEGd8PsfGvJsOT22CtEeCSwfpF9N4jwrEVaeaHgPl4pj7T+btqFXWDye4NRkfb3jHPxqRC9FQJN1aI5Mev5qFfjXBF3tOiq+T/LzWWp+0eADEKjqaLUbfmtm6DDDjIqKu+q1Sf+qhI5Iom7KliaDovZpfcT5SNqmF8bVndhcBcU3EpQVXbsGJtWJunK05l/MFVE/we442q3sRfMbFJUX7ntgAPYuXMnl1xyCQPV6tiWzZs/6eL4poF5CiLlUok0TecYkPnwcHyyc+p37xl/+s7duz61deu2jmOKucc3twBnhxoGCySl0oEDg6X/J/APiEwHiAsQRzMxxIIgwl8C4Nx24BfA1wxOM7NbBGGqVsebp1Qpk4WAimIhTGRZ9pVSpcxAuaxtjRlV0ixjKk2pDg7hAO+zZt2CD4HJ8QkGK1Vq9RoD5WpzaFcY27MH7wPrhofJ6hmothQ5FrsIAIdobmi+c+FkvBXxIB0tyHnkxtdSpdWBh2B2U+R6kWyza8w4X0TaGtwq8kCwCLGsGeIznxrC2cDfd1lhH8gGcrnKVn8qIe8AP06E53ZRwC0W7EbozzBpxyIh+VV13KmLImoqepG4mQaFEFpdCwBU5I/ShSdVVO8I+ckJ3hCDELga7M2q0mXq9YV4b68zs+nRj/z57famtj0YZyLS1uAWOMGJbUX0BoQHLNjbDNX4B7JIbPlyEXge8HiWjmhwiHwV0Zf2WMUug0sE7tn+Z8O56DGleOBxWVr/SlSKF6Se7IQomG++opZxT4szLMg+Fx0qDO6CglsJpVLM+edfzMUX/4lqtUx9iSloZkYpSSiXSm/E+Iu908rusRB+G6tceOCWLQxXqqRZShwnv/TBztq8eeFE/yg3WuevHkAYMbO/N7Mvtq3HjGCBcpK0fR+LQKlU/tvR0dF3AgfM9xy3yujARoGHAQ9T1VeAfA7hE8AfIE8XODY5heis4XozgllolenJvT1eBBfHNDDGx8cpDQ61rbejsdAMDwEDF0HkMN8xQ2SOKqruZU5d6Zrrr71k565dc8q3PBSJe6T3Ihbp93uWwEyK8i5o9rR6qE2kgdmPgL/tsMWRiBwJchl5+vT5XInxe2RVVBPyJsIzmu1rGdwlVa12u7+ZXWAWxvPLszIWt7iO53grSNuY+HncLMr1c+7IefeJwE1dtcUslx6U3BE71ZggP03y/oHKuqeLSM8OAzP7SQjhq7PvpU4SiO0bhZDHGb+qwxYbDTsR4zuC3rdNd3IXwgWsrnLGKF2HCcohffSgBwj8EOVYOoQ05QnUSm/LMvet4O36XkJV8ntwBUJbdN8b3YXBXVBwK0FEOO+8C6djmJfC8tkjfy3IS1diktWKIgLeXySNOibCcKWMuQEwu7AefPshX9f2dZao2XObH7UFmBnlchlrSu3N93ybgYvj146Mjr66naHd0yEhBzuVl4jwvHK5/A0f/EfN7AwwC5lnaHhdM+wDvIvIvCeIYAIuirAQUGZSwC+rLZInA7nsyj+zZ88e2g1nB+85YNuBdz7wgG1PCyHYxvUb/jyybmTONpZmlA7aQnnjKGHv6HDX6OeTacQh8GPnpjO4zCcRuKcPjUQ12bpgd7NzDLtF8kjX1SJhGTJoIdhHQhDUrWTYaseSRukmXtyYsCBz5kqILhhU2dFNSwxGQmiJNzpilzTVgmTKzF4kot/usRPm6/WJVzXSmrWeJ1WlHK/r5fkqBbPzVWSXtJk82Zx4enKa1s6plIfvvOCYjD8YXCWr2JHrkQVhbF2QmNl1mHxJhKd32khEjohc9K+NrH56ye2bOfmiVhjcBfslxYTb1afrj7tzyi237Oayy65j3bp1RNHiu5oZKnpI7Nx712TWMzNw7gYqFUAIZtNye+3IP2xtDb6dItI2rtXM8BZImiofC86Dgai8RURespLnyMyq5XLpCcATgHPjOP6o9/6rIrKr5eUOIrNVVlZlWn0IgXXrRti9ew+NNsMh1YEBRkdH3hhCKJnZHlT/HLm5j70hlAaquCgiNPr5Vu8lhFII6SWq8RUickS7TQx7gOVKJgsfHuMsEVliOGDfYWbfDMG+m/+1NuJVe6DLb4m42Rr5ahFpNgUIU7Xd3ymXBk+Povgvu35WzU6LXPLjfPJmPklSxfXamY0w9jTnCDxoYRWG0+QemkQPpp0KidkZItJNKNWaRkQ2m/FmEZ7IIgpXovLiJCmfTz5xcuNea+AsnGvpSe19CoO7oF88+zwi6lZP17FuAwNlfvzj8zn33J8zO3lLO8yMAw44QLZs3PTeEMKKpWNecYykKYLHTHT0ytxyIkKlUiHQUSOqosp7EGklo0nBGk3fXCxIvJxRgVlGwb0GBwbvFUJ4pRn/bdjH6KB6sNK0JnFu2bKFickJ4niWlrUZ64bXPXOgUnlU5j0icrkKN7Q94mALOytrDw2WWTA9L5L4iHbXTlXvr5q0U5EwMztbVNaKF3I+V3kf/oXm+1h1v7Pdup6iOP0PMwSHTA84CGa8FONBdCfbOBU8r3OSzB0Ys96eakE081No0J8kSeVB7UO8OA7kOe1LsPPygIn97prNQRwHpvX6ZaL6mTiKn7nIphsxno1wLfvI4N6XFAb3fsByh7JXAa/wNMmHFNdc425FWJJw7VKXP4ocExN7+OQnT2/qly5uAJkZivyTiPzlCrd3xRARGlm6fqpWa0p05T6JgX7S1M8vm/ymHRpqHwMNYCKnmIVJQZ+McSXGrlp96hYXJS52biQLftBFbotZuLOK3ot8wumh9OE6aSpRHC7CWzF5tgnvN+xjBrtW+zPsvWfz5s344KlUZvSsFW6H8bbMe1SVXbt2/XDHzh1+weEFz0g1ZpMoe8n92+8pkSQeAOwMw57YYZvbNZc5GPwO4XJWUHJvpTALPw8+PNlMroSVNbaXeO106yZsK4Qzb8eRLltUhxkhfFVIZHCmMLPfh2DvFuXlS5WU+eyjPgsXz26IIDgX9WT8WlOa0owfmdlrOmy2XkQWJFIyY6cPnLe0quVepd8byEQN77PXJXHp0WZhU8cKhIdD90mubk0UBvd+QMtAWEMYcOG+bsRtAZn+nw6/S+7d/sIXfsj4uHHcccd1UaYcofBmv9SEuX2ImRFH0VFRdUCMPCtGbnSHRaUTukXUdUx/3Yx//z8z+3auQ5yPeMdxzO7du6lUKldP1KbcpvUbjsh8aJhKArJFhEOX3zAOF3hH5KJ/EeODmfcfM2xVPd4hBELm8ZmHkAEyjOpnQUahNTFSvpOUywtuRfOe4aMO3Zse7r5D2cwCmP1UnDboJVba7LxgZG5tfS+vx/hoI228zYkbb70kZIUM7i6u5jh5spalvMkRQiSzYoPDvBERVRnppqMgIjeKm22dGlO1cUKY6QeKyHsqpaHnicjQIgVl3jf+x4e5yZqcRChJV/rb8wpEkN+Qa7Qf2MOOv1SV7SuVLXaF6KsxeSKuEoT06jSrvyZy8fsX2XyQNdh53RuspRdIQQdUBL/2vNwFa4BSKeFrX/spX//6OaxbN7hk/GEIAYU30bVXad9hcPvJ2uT6YHMNznYfREFyTesuPl7OOW655RZq9YV5UOI4plqtMlCpelHF+4CJIUISuejEOI7vUy6V75ckyV3NbJtz0aq8QwUOi6P4rc6552Tev8+wj7OiGssdMJyofhzyREEAZnZ9nCQ/X58stFFDmjG6dUsfRsoc/hQCzyRP7b7YBRTyULbpxBk9eQfzkv9MnmSkG0k7AIJxpu4doygFJmjfqUiBG834DdiPDE4X5MbZG+jCyYh90fZKmjWT8Ez/er2o7kZkcYNbWA9+vbUSBhlgwuzzKYtraM9uwu/nF15Kqhhh1k0jUyLSWKKgkCQD6fxzZYHmMfaOWRjD9HyR7g1uMzu3qY2/qjeXGR+xwEdZwt4TEU2z2o2NdBLEUImoVLpLftmKgU9DDfP20aiy7onAfVag+bcqCoN7P0HzDHn7uhkFawQzGBqqcNFFl/Oe95yWT85xizv/VJWBSvWhqPz1XmrmshDYXC1X7mnw7Xnr2xKApXKDu8hxw003cuUVV7T9vVKpsG3rNgarg5gFRORYgSc0w2+OGx4eFjMjkmjVvbqWZ3s7LI6id5jZs33w7xeRz5nZTatUd0nUfUxEHjenHWanJUmyILzFzJAkRuN49kh/P+wRsTNtseze7ZgeoehyPxFCsAyzH6pItwb3pMAv9oa5bcY3LPA82k3aFBtXlXEzS9sdrkj+fC+7DZ1+EMk1kWc2GDORP8uSibJkQ6MxdZgP/loh3z9JykSaMJ3VROToLhv3O5v7N6KKzhWOURZNEz+9s67YIyQQ8EgIP3Aueky3uwXLzsr/tcr6A8JlCD/vpk8cQsCHFOdi4riVK2fpHVsd7iSukqW+kWbpC+Mo/gnLUN25NVIY3PsJa2rQqWCfUyrFXHbZNfzLv7yFP//52iU9u2ZGpVIpH3fMnd7KfqIwY3C5iO7o9t5XrGOnVERwTtlxyw7GJyam182pz2w6TTz50PDrnOrfAZXZ28wuc/b6Vvz8aiAit4tc9J+I/Fvkoi+USqVPmNlvV64CDlTkowgPm/dLXSx8SNoZ1N4TrRsm3jiyqIJMFyhCSdTq3RjdzczieZL50EMYRVNyEbMfIfL/lt5BMPN/qNX3XBpHJWJXXt3YPmGPKNd1neVw9q4qy/5ILHloLZ341r1gdjYiS3gxjVJp8EEYZ0PexAD4GQlJca6t7vl8JiCcN1fPG0Ra+VL3DblnN5BmdVT0p5GLU8O60dS+IfONX4HgXMIqH0MsytLZMyUf/au4IeK49crrrV0iRiMbRzw/dzryAdXo+WsuIHYfUhjc+xFrMJa7YB+gKkSR47//+xuIDHQVt53LU7mnkae3XvOY2aem6rWXVsuV65d704sI9UaDy6+8kvHx8dl1tKuXKIruqvD5AEfNLqOZje5PInLJ1NTkn1TdLlHVNE1L1UrlxMz7451qLzGcvWN2QJKUXjgaJ881s29lPvuEiPzUYFe/RTrVJyRx+a1gC2LQzezbhly0IHWh5Nn+Kps3IE6xbNnzAQzpPSQihIDrwbNbT8cR5PxKeWiMXAJw0SaZ2U+iqGwuiprKGKvq+lAk16nu1ehe5mTJRi+PmM3Y9t8B/n2p7QWeFMTehlGjGUAhYvjgiV3pHiK25GiDmf08mF0+f/2+nm/YSjNfSQZzTW2zK5CZ90Y7RASfpb/G2BHHpfye3wsf9qWzjxpRsz2tife9xperRkQuIvUNpmp7XjdQHfkrWIG5LbcSCoN7P6KI5S4QEZIk5oMf/Bq//OUfqVRKdDP5UUUGy0nyorUs39b87lxvZv9u8JmVaquKsHPPboIFhoc7xySaGUODQ6esHx39QQhBAYLZJYL8Ys+ePWckpdLPS0n8e0R8bWqKKI5RFzFVmyKOHLt27163edOmRwcfXiwiC5JcrBTN81IWkcfFUfw44MoQwo8ETgfOppm5b/75m61eY2brnMqp1XL5X5xzJ7erR0SyRpa+rZGmbT+8oZEyODqEqGLL0ygxoNGvi9ZCaJu4Zz4iQrk0BMa1ZlwoQtt03LO3z3zjp1mWEkWrmQhwfsW9Gd3LnShpcDQwRvcX4AqDSTPOUeFCgaV6/EcJvAP4l1l1AmG9Ku+0LrIshsD/9BxytBex/L86yFmCLGpwN7Nl/rgladhKdrWKdC0vm3cyZ/3Vs9Gdx9W7LEFEdoYQ/k1Vv9RDAbdqCoN7P6Pwct+2qVRKnHfeRXzqU98miiKybPH5QZDHTY4MDz8dOHL1W9g/PoTTROXFBlf2uu/saN75z0cWAiPr1zO6YcOiZQiMivHMEMKnMTsry7JfmPAnjIl6vU4Ux7O3nU7FPuuDNGbwqWD2ZTV7qaq+ei89q4eq6lPBnppE0fWjIyN/MLNfxlF8GbnxPW5mmiTJcBTsEBW5a+Si+4jIIZFzHd8nPvgPiep5SZvJkphBKaGybRO2/AyTR4CcTm4YdPt1j0DOBH2nWfc7zQjT2I9AFjW4zWwidpVzY1eZvePeoQeju5vOxhJVfYR8MupSpzF/vIQHmdk5PrMGTt/lnHxi6Trknw0OB74A7FDRO7ooeZZhixqnzb0vUpHTFrZuDX0JraXnLz9BeMYSWwcR9+MkjvbKfSXwDIN70FsooQCvA37Vc30qZKEOZjSyqS9Xy8PfVo0esaau1z6iMLj3M1qTJ4tb97ZHqZRw1VU38KY3fYZKpUIcdzaWZiOi68rl8vPXqndbVetTU1Mv3T0+/l+bN22cHd/Zltla463/RARBceLw5uecl3xu1tLJWQQmxHiGQU3I9e/beXfMDHURqtpJ83wqZOl/pKJTSRy/uYtTsGKIyLY4jreZ2SmlJJnl0YZKuTLd/tZxLXJGrt2xa9dr0g7ebfOe0sgwB1TLc2bS9cmQwKN63kskQ+SdvTjg8nshIMiZiLyKxY3M3yBc13O7VoqW0d3JFDaIoqjnYf829DqxTUUEUcMsfA70KSCnLLWTCI8AHgEtr3w37RYajamX++CnZGYVGCRJBcGxFgw5a6bksmA/cSo1Fsm2iHG9GRcJPfQUl8dRwuJhLm0RPtx7VYaII3KllrwqIdgLVe3+3EalAGdTGNz7Ias5OatgbaIqhBD4zKfOwDdg4+ho158ZEf5WRQ5f1Qb2iSCX3bJzxz+Wk9KZ3RhuIsLY2BiVaiVPJ+5tTmyiQFuju0vmDBe0DJnMe4aGh4gih2H4zDMwNISo4NOMJI5J/bxRW1V8CG8BTgIe3XtT+mdW2Ejb9UuhItbw2f8rl8vbS6VS2218vcHI7Q4nqlb2ZUr3hbqOSyAihNw4usDBDSyismHGObOSnO4bBDralGLzFTr2FgbgVCBYGoI9xzk9y8w2r2w1gmH/mWa107OQzoqfN0SUklQW3XtvMj0aIVwB/Ba4e6dtDc4HdufR32uavuPE4qjMdAiQ2R8NebNgb1yphu2v7BdqBQVzWeMPacEqUC4nnHHGrzjrrAsplxO8N0I3S7BIRf9xX7d/PiKCD+Fr3vwD6vX6mUttH6wp+KdQb9QIi4y150a39p+SkNZEyzoTk5MIECfxAtk1M4icI45jXBQxODSEDyEXJYsikiQhYG9jniE/HzM7G7hurSTAaKTpa2q1+ldbnvB2S1QuMXL7w1cinGTvYwImu8z4+aKbWTjDLGBdZx5fHUQ6xGnv69tFIPU1GunUH+uNqSdjNrFiRYvgfeOLk5O7XhKayadmwreEOCqhuja82wBmgXpjD7X6npBljZ8s9iybhTMx3xy6uLUSSLMpsmyKzNeo1ybeFSxcuFbecfuKwsO9n1LEct92qFZL/OY3f+aDHzydcjXGXPdXXpGTgbuuUtP6QkVA5fWW2WvMCO1ewk35NswgCxlCU8IB6WoIXRCcOLIeP2oiSpqlTE5NUqvXcc7lkwLnhpdMu9pa4SoigqrivSdybrYt9AvyZCt3aF+fkGbZlY0sfUYSxaclcXynfTV6JSI00vRzF/3+4td3CiWB3FO+/rCDOOqAzfh9593ui2CeRjoFGFGU/DiJy4/ucL53ClxofSinrBa24K9927C805yS+RQzvicVfUwSlz5lZktoc3dRrk8/O1nb/QzD0nbKMHHUOWJjXyCilJOh5mWRH5nZCztsGoBzpiUWb6WICj40psPNzKwW+eQFTt0P2Nc37j6kMLj3UwrFktsGLlJ275nkU5/8PwhGUu4t3FKRf1qlpvWFqjI5MfGlPRPjr3ZRzOjIyIJtRIRGlhIBsox7XIBIFI9NxxN23ljAjMmpSSZrU/gwO3sdAwInAw8S5ASnul5EMLge+BnwWeDS1sZZlpGlaetj0yiVyldHzt2h3ZGYGaUkvlutXrt0557xB27bsvUT3vwj+j7oPsnD1MKXvc+emWWZLXW+th1/7LIn6+0LVB1RFDc7UHqmmQXajPSa2W/M7DoAk1UWA+yB3NO9743tHCFJqvjaHprdgR8Ebw8Qsf9E5JH9lGhmOyzYG0MI72qvkGHEUTJ9DdcS0optE34O3AxsarPZ1WAXrY3rt5oopbiC9xk0nx/vGz8Usf9xLn76vm7dvqIwuPdjiuyTt36SJOa0L/+YP/7hagaHqj1NUAtmhwEPX7XG9YGZXX/DTTe+8Mabb6Y6MEC1Upk2hmeGjA3vA24FPECKYMGopQ0W+8gJTdk8oFqp5AktzFCndyrF8WkicvvpbZvtEjgekYcBzxP4V+AzkE+2HN+zZ9oj6aLIR1HU8dqFYIeUS+VDVdzlPksfY8KbVN3zzWyvvJ9FhFq9/lGn8hwgmz6+DhNGh7Zs4tCT7tKtd3s19fQqMm0MG8xKUNSG6Z5qpNP//D15p6mddvqPW5MD5mYhX3LiV3XueZu+5t1MGFvpoOTVCvBulms4lxC5mDSr56uESwP8BcEeLSL/T4R7seRxCWbhepDTQgjvteAv7Sx1KCRxdfHCYGiJ9id0ODcdulbJIuPJ05MczEJTrYSbUL1ERBYY3GacayaT0/XNVDewRJtn3T8yS7vbFj0Zy2T2+2ep8zrnGreSUzWymWkWzffrq5xLHg3WSTKq47VZrL4OrPj7c3p+TJ/xBYXBvR9za+8j39YZHKxy9rkX8PGPfD33+tYnl96phRlDw8OPcklpYK14gpxztn379n+/8eabrwWYnJjgN7+9kHXrhtm0YSNje3YzMFClWqmu2L1t5F71cqlM1kU2xAXWoci1IlJfYrf1kbpPKHI12I+JIrZs2dr6zRm2ZYlrUA7BD0aREoJPxbl/27lr5zeGh9e9WUXuvWSjl4Gq1sbGdr3xuptuesORhx8OXWi6H3DcMUSVKo2JqW5eQj9zIs9hpSPgRCTzjcvSdAqncdMIsw8CP2xTl5iFs1qr69lUK1ypFsflp0cuOWKeu1R8sP9rrZJAyzIaV+F5ggy2Px4RHxpX5CErELlSnh4796L/KzDcfr/pNl7SzWlqKWJ0wSVO5Nndbdo93uyS1r8FUE2AuY+ImX0d4eticqxh9xaRuwK3N2MAUIEU4WYz+7UP2S9D8D+NXHzLYjeUmRG7EqoxwXc8AxPAs8hVQjpsZMEsXDV3nRDMk2ZTzG6DYUSafDuOKjvb9JglmP16WpLUmN7Xgv27ihw3rw0SLJxvrdEjkVl6pvpqkM0d2izkia0MEdKsRubrIJBElbc5Tb6wElJB8+v0ZhcCaD6HYQzR54BU27RRgtkf5oc8CRHlZN38cq/z3j9WRY9pVw7gvdlV81fKgnkU8kFEf9CmjNntv6jz4S1BcxCp1Zk3ya9vGlKyNOt7dKUwuPdzlpnzYBl0/dIvWIL84TVa0/zyBB0JF198Oa/+j4+wc8/unuP9DKQyMPT4XvW+VhPv/e+rgwNfuOMd7zgnCNpFDo0i0jRlcnKSgepSzp7eUQSn2syS19O53BngmQo/YZY3qw1ORF5rIqeIiIU0BZ+B6IGSJEvqn8dRtN5gOglGrVY7a3Bw+BRRniciL2l5y1ay8ySiv9y5Y+e/1hu1s7Ms6/oeMyD4kLdl6eb8yZQ/LbOpCxAgBE/qa9ONMvgR+bKA1jMGRubreVp4M5yLv4cubq7kuxrAlKl8ZvE2BVKfG58qClamOXDyuaWOaaaNS23Xde/lBlM+1N2m3WNhpvbWPbsIF5nZRSLyETMjeJB8WMJat1vooiPcQkTza925ygbwiaXKadfm/H6qM9/gFuQ3sVV+0z4kbLbXc1Y7kXMMzmm3w8xjNp1kxsC+2k3vVQAf0rydApGWvu2k6/uhJ1rX2fKexBTwqY7b2sJz2qlNZnaWwVlL1TuHhXrlZzSXjrQtZ9EdAMmPw0UgaHOkE3zwuKVTdS5JYXDv5+wre7swtlcQgRByPWkVJY4cX/jSGXziU99BtcQRh/el6HeHSN0914p3G8Cwr8ZxkpWShXZrCJ44jld1IpFDSYNvq3AyX4FkTtuw80X0zU7kNYuFcKnqva69/rqjp2q1P27dvJnBwUGC948g92wuisyaaNmcGgrQMOyd+PCVNISnquqTnXNHLFVWxzqaITve+8uC2YedygfSNJ1o/bY/InSr5zxvn1U8XJlzJQvasHZeSvNofz+ttesovToNCrpAnaAqpFmWfw+66//2RGFw79es2fdWQR8YIJFy3Y3bef0bPkTmMyLXeximmbF1y9ZHrh8dLa0hg3sywCfBFkz2FQNpdjhWmwhlMq1Ne2NEcn3z8fHx+VkjpzHAibxxeGjofuVS+UGLnNNkcHDwjkmp9Mcrr76a4aHB6JCDD3l66EI67/LLL7+5Vs89o6UkYaBSbXrCBMSumJiafE3w/l0b1m98bAj+SSJyIrC+2+MWkUmfZb8eG9/zSRH5YrU6MOacy493zdwiBd3QnN9bUFCwTEQEFUGdYBZW3fFQGNwFBWuI4APD6wa5171P5I9/uIqk1OucM0MQquXKYobh3kUEy9IXaZZeNsdblMeTYFHcxuYzyCcK3Q24ormsQFOELMumJ2qaGdVqlT179rBz587Fds0OOfiQZx5y0ME/S9NG2wQfZsboupEtk1OTXJdlVMqVZ2KdE2DMYue2Ldt2WtPzrqLsGNs1R4qw6dHabWaf8CF8QkS3gd3Fqd4POBbYCKw3s3WIZJKndL/JsKsx+2nm7Sf12tSfd+3axcjIyJqRuivonjy7Y65HrWaEkC8FBQW9kcu49hxeuGwKg3u/pXjR3hoJITCyboi73vUO/PqCS4hj15M7qzlJcFMURXdfIwb3jjTLXqRmn9B8Vn2+1gwTIajg5vm284Qy0b1drB9B5ZiYaLeZnQvyXeB7ZnbxSjZQVTnyyCO58MILaTQ656jZfsv2K1TlOdu2bP1KJ9k8M6Jrrr2OkZGRY7Zu2fqGNF1aycPgt+Vq5cbpFQLrpBXm0fEaXg98y+BbM3GhEk816uVSqeQdUjOzkMegMm28LxY60y0Lk90UWQFWleZ1m+19ExGcE1QN720fS+TtndGpaaYngKx80TbzLK184QX7HJE8a/P0s7SXH5vC4C4oWGNMTdV41KPuy09+fCFjuyd6DitRkZOATrJLewsfzD6D2ZtCCJcsmNybJDRnqLTb93FxFH2CGSmsYRF5KPBQC9YYHR39tar7Dsb3yBPLLJrJcSnyyXOOo446iksvvZROEwgnJyfZNTb21W1bt34QeM7830WEqamJK+Ik3nzQtm2nZVnW1TUQC/9n8wLLB8olfGjO4un+q5A2l1WhZdRVNg2BGap5OEqwrDnfSNkfDJW9Z5wus57mcPdieuciQhTlEpb7yvB2Libyq6n+mF8zVSVOynmU1Syje5Gks10jKsSuhKjQSKea+tHLL3f1aL0b1ia5YZvftyHs6w7hjKGtsm/FHgqDe7+k8Cbdmskyz9atG7j9HQ7hpz+5EC335pUU5eR98WJpGqkWzL5O4O0mnJPrpTQ3sOa/4xJEDrKF6gSq+jQR/tuMTgIrSRwn9zCzewCvVnW/D2ZnAGcC3wPGu2jjAkIIDAwMcOyxx5JlWcf9VZVGmr40End/hGNn/2ZmXtQdd9C2A97inLtjNx8Zgx1m9skF60NgLcV9tI7lqEecxJYTDsXSFOdyeY+Q1TFRnMYIMRasz/wAq+8pF1FKSZVGWiOEzte5hTZ7ir2EbpgZTh1R1KdGUBeG9sJd9r7h3fKyiyTE0Wju5V6VevPJ5JXyOpyL5hybCEhzELAfw7sVotN6LyRxmTgqkWZ1Go0pspCytr63RpIkGBlZtiw/w6rhnE4/N5A/Q63wp33SIVSd1gXf11eyMLgLCtYo97r3nfjpT36Hi3r0cMPd97qxjVCv1787MTn5tnUjIz9qzfVf0I4ohtYM8FmEzHPAtgNeXElKbwshLGppznppC3CMihxDCBsQ+TGLGNx56vJGx6yTIQSiKCKKOr8WzQwz2x3Enq3Ij5j7DtVSkrxpXhsXRUJ4l4VwbdvfEGhNbNyHtI7l6EecxKEPOJ5Qy3KV42lk+v+0lbgo80QuJhCm9Wxb4S0LEULwmGWoy+WTZVoybfnH3jp9ovm5LEVV4qhMI53KpfvaiJYILWMy/0U1vz+ExftBuaRnlSSuoOpmpBNbkVQYWIez0DT8lpPBc7bhHYK1bescUb8ObVmKuUZVcwJy80QKYAotnelO96+IYktYyWaGaHtje25ZM4Z3R/Xteeu1zbPVKr9leDdaE6zn3SPLtRuNgDrJT9QCZ3XrfM6juUJRquV1pFkNaJ7DFXhHzC9CVabDL0IIuTJfh2oEmd6+Ha3fWkb3Ys1VFRCbVpPKIxF7iLZuNnS6/eTJz9bCgEBhcO937Os+WsHeoNFIOe64Iznk0M3cfPNOXPdhJesxjlrNtrVofay892eK6tt37Nz5be89I23StZsIIY7RNsdhgIuitwxE7iV9eED+iNnLzWdflUU8ii1je3xq8eRB3dTfTOv+U4OPCsxOLCJdG9oI3sJ3syx9W7v09SKC04jUe9QCqtpNTpqVp2VsP/IkDr3/CWS1OtJlAkNRweWDHs2PXuuHedsBEDDJpnOBiLS8YZKHqkw7T3vwgkteTi77PNPmVjx7uTQwo309r01u3gqR3MhcHCPWBJFSq2M2vW+rODPDW4bimiE45BkNhGUZ2vNpeZ/bN7NlOXlEI7K0jjhBJEJMF+0UIBBF2tGInl1/a/uWqSTTahApk/XtxFGVyA0CSvtraqi6JY3tufWyiFHY0osG1cU7sq26Skmled/NU1ZqlkXPz2TACHhr4KQCSN7xkGZB01NcbBEjOr9n47iMBSPNMhIX5waqQTBQcQva3JFZz8lsHDP341JzP+Y/L53IDfLFt3Xo9LG0MLFZRveMLKLRes4yEMNpgknIn/dWP2QNmUyFwV1QsAbxPrBt20bucpcj+cQnvs3Q0NIZfA0jjuKjhgYGN6/20J0AWZZdjsh/pFn66TiK8+HZNt5jn3k0jnI34cJWl0XkfeLkGT202TB+mnn/SXXuKyLsWsz/0a2xPZ8QwhylkAW/Y6+LNforYEtPBQM++LMbPntKFsKCmGsBys5BrpnNlVdfxcDAQJ5yfi96u+d4tu9/AtlUnXbG6crRyRPavC804L0HFDcdcdSus9JdG1frGemm3IBHMZSVM7L7QvLWQGvY3RACErSZ1GaW4TwdO93/DZBLGhohNKjV66hOoJqgkoCLmvd3y0Bf2rPdT/29PEOL1SvNzsfsbRcP5xGwQKD7JFNdt63VocNjIff2hwB58hbFFmRqZNrQ3l/Ije5Wwi0P2pwHhCHSyt65L1u4NIXBvV+x/zwcBcunXm9w0r3uzDe+fk5TYWLpt4mI3tnMVvsrnoroB3ft3vHGUrl8U9IhBENEmKzVaTQaxNHgQs+myAlOo/cJ3GeRugKwB+xajIsNzstC+Emk+vMQQluP+fw21NMGE5OTzSyT3SMi057KDk/e9cF4vQrv66FYzOyLk/XaPzrn9swZpiYPySg7Nz25R0WYqtXYsXMnmzdvZmhwGFXdazrMeRjJCWS1tREvapaCOIJo04uboOpoZaLbnwyItY6IEcSDKW4Fve/N0pvPV4r3KZ4JfJgAFKclHDHVysoa26tNK5wnmzU3RfLgKNDmu8f2ViCxgRo+pASfErvBGcN7PzO0W4goaTZBmo6hqiTJlv0uAVBhcBcUrFHq9ZQTTjiKU065K9///s8plZaehBVF0Z1WtVFmP/Xev9yi6CfQ3oAVEbwFpqamaDQaC+MkQQR7vqi+Fhhqrt5t2K9CsPOd6nVgVwE33LJ9+/aR0fXjTnUnFqZMtPv46KZne2Jqsm2cbjf7O+cQ7zsHbfr0o7jonxC5cxdF7vQhPN/MPjW/uNnGtsyb8No6fzfddBOTk5MccfjhVMtVfA8psXth2rP9yHtx6P2PJ6vV11BfvzmUbAFRpVQazNdJp/jwguWzmhd/5qqF0MCAzE+SRANUkiHM9kUc1fJwTgkhf47qWQ0Uyq68D54hwcxTb2wn0z3E8TriqMoaepiXwf75tBcG937DreEhKegZEe557zvy0Y99iTiOFr0NDOOQgw4+Ymh4uOPEwP6aIAA7G1n6ukjk/WbWUXrOzMiyjImpSbz37YZONwp8XJBHAQSzC4CPmdm3RLjChzDHm5ZlWV/eXAHqjfp0GEnHIdy88FFgZ9tMk2bg8tlYHZRD6gH+S+FjXTSrgfAVFW1OOpvrNUxUF5WtEhHGx8e5+OKL2bBxI4cceBDqHGEFg7stGMF7jnrESRx2/+NJp+orVvZqsNQErIL9iZkY3Z5i9dcYqkoIGZP1SYIF4rhPtZoVIY8R96EBfpwkqu6nZ/XWQWFwFxSsYWpTdY4//mge/KD7c9WVNxIniz6yTkQOWEljW0Wo1evnZiH8o3N6EYuEcJgZ6pQ9E+MdYp/tziLuC8AxwMXewlsajcYXkzjpGK/Qb6yjkU9CGxwYWMoXUo6i6ItZ5l942Z8u+127ToIBBx94IKPr1uHbnVuzL4K8DLjdEs3aIujfN9LGh1sz/1tEIjhd2nsvImTec+ONNzK+Zw+HHnoo64aHwVYg62AwzAfu8Jf35aB7H0taW9vGdkHBWqUVirZ2Qh5kDbXltss+nrFR0B1Fn/S2SgjG8PAAj3ncA1DncM7hoqjD4kYRtq5U3WZGFsIHJycnHzI5NXlRp5nquS/KKFcqVKtVVBXnHKo6s4g8M9LoB2BVM3tRMLunmX2aZSataYeqIk6JSwlJqUzccSnhovgeKvpggXdPTkxEExMTjI+Pz1kmxse55tpr8U3lgJby2PQiMmHC+7tqm/CyRqMxUq/XaS21Wo10Ee3v+bQ88ROTk/zhj3/k0ssuY2JiMg9/6dfda0bwgXX3PJID73VMHrNdvHYKCgoKVozCw13QDwq8EDgE2k1/LugBBa4Ee2enDbLMc9DBG7hx+3XsGZ9sah3PxQySUjJy+CGHbl6JRokIaZq+YNee3f9VimPEt7G+zAghkIVApMrwuuE87KJdeSY/A3u0ef9bUzexEm3sxI6dO0nD4koALQ/8+nUjf2uqlJLkgVu3bn3cNdde+8V224+Pj7Nz1y6qlUr7cB2Rz1eS0qtFZHSJ5h02MFD9Vx/Ca2evdE395VktVjMeQ+B0oK013vKSb7/lFm7ZsYONGzawecsWoihCgjUVPZbGQiCknupdDyU5ahO+vqLJKgU4HDhS8s7gMLC+uZSAG4FMRK4X3OVgVwJXs4oZMwtWBGUZ7/7F9Lfz31alt7esNu8ljgQOE5HDgK3k4W6D5O2+BdgJchX5M3IpsGMftXMf0ZNDYQg4GjgEYZQ8+/IQsBmYAHYg1IErgSuAy4HtK9na+RQG937AGpwOpAL/SH4zFywX4/dmnQ3uKFIu+t3lOE04YOtw2wl8BjjnhoGVyLFsZvYvYB9YcOeZEYLHNwKjQ8NMpRlTtRrOOSpAFHVUFfjtCrRrcSQ/Nbsn9pCmS9trqrpudHjdX7YM182bNr+sVqt9PUBtQTBM0wOcuISgbY/vRpDTgacsVa8T/X9B7GNmdg00DWeDyfocZ3+InbtvHLlTQwjPbbWhE2bGzdu3s2PXTrZs2sz6kVEGBweXnFhp3uOiiAMeeBzl22/F11dkwGGLc+7RwMmC3hnkYGDdYh0gdRGaf47GJD+XPwS+A5wF7FpGW4aB04ADllHGSvJ/wIvarH8V8IS9UP8YeXKonaB/Ai4EfkVucLR9aIyZJCSzeIKKvoo+DFgRvTqJhx8j0DZmKU/jnhBaEnBtMVTkIyD36rLaYNiTgAtnhVY8BHhXb62f5knAr/vcdz4ngTxe4EEIR4AML755HtYncK3Bb5zqt4BvkRuO/TIAfJncibYW+BHwvPkrF5k+RDOQ8J6CPFrg7qJ6FHAwgnYx8mciej3wJ6f6bfLn9II+296RwuAu6JdV9VLexlhUINrMKJdLDA8OUR0oL7bpUt7VJWm+mJ4D8qHpEBLLVddKUURI06Y+rxHFEerz7633nomJCQYGBhYzulcVQTAJHHrIIYskjZi1vdlDgg8HzmSXi48/8ogj/sqbfb7d3hbCdObEdnjzn4rE/QNLu2HWO9WXBLPnwYz84A033sjU5OT036MjI2cffOCBpx168MEX7x4ff19XqeLNaGQZY+N7iJN40TATSwPRuiqbHnIcpQ3D+OVL/90FeDqqj3O0Qpt6dhasyxc5WkWeDVwF9nHgQ8AN7XYwM0w6xstGwJ1h5UKtlsmlHdYfAhy7Nxowcz/kCYWiuFwD/gB80eBLwJ9nb29mBEJT4q5ZBvwW4Y69126IuGOTZPQ44PwOLSRYRpZN0vb+MUPEbXVR6QnMqBwtVetVAS4DUKbvlVH6P+eDi1RGo6u06/JXIvIC4D7SPknBUhwowoHOuUcAbxSRr5vxTto4N0QE72tkoYHThDYjCEp+LtaKwX3V3D+FEBp4P4XI3FNlWEkl+hsReYrAKR0SPiyFkHfKD3DO3Q94PcI5ZvZfwNdZoZGRwuAuKNhfMGHxVMw2upzBEOccY7t2veeKq6/6kIgSgmf9hg2MrhsBH5jv5JptALaMxH6NbllmSjARYceunQwMDqBdThp1ok+cbYw22/sMEflCu8aIc3nITMf00nI22B9B7rBU3Yo8XbD3kWfKREQ4/OCDCXPL/l3mfbphdP07qgODZ/ngL+zqwJgxvDUEkiiaSYzRLN9SD+urbLv3HdGhEiHtPoa8TV0DUVR5pRN9IbDSkgyHgLwG4Z8QfQPYB9ptFCzgpO2EXgNqK9ym5dDJEtuHITRSBk4AThB4Gejnwf6DPNwHmLlvZj0uvzPsbEEW09DvVB9mjVPTbOr8ThP5Qlhkwq4ZzpXuJVIe6u4dI4RQ/4YP9UlBcdF0ErHlyPt0fMmkPiXLsul3YpvmHBm56jsEfcwy6p/PiCBPcRI/Tpy9y/BvAJlzT5kF0nQ3UXlTp3fzWpolveA5ybIJml7smZXCXWMXvzu/D1dU2SYC7i8q98c4Q4M+H/jdcgstJk0WFOwnmNgSyzI83HlWwz810sarozgmiiPK5XI+ATKKiCJHx/Qv00XkL8KJiYnpD077AzEkeJwImQ/UGw3SLF1Q+lLDgDb7H6rUGw3EBIcQLbE45BAReVCbYu9PCHe2EGi3CLn6SbsFkbqZfH/RRs9QReS5pprLDqriMSanJploLpO1qWvM7CYfQqkURR+IIpe41sTZJZYoikiShCiKcqtCBG+Wd4SyQOn2Wxk45Wh0IMmN7/65WxwPfN9J9FKQ1dQ/2ybo+1XjT4u4DfN/3F+So+wHDIP8E6pnA4+e/YMAzmR6kWBf76cCyTXxT8WyPDPivCWQ4lyZcmkTpdLGNssmknj4od3r8YPPsm9laZ0sazT7y6sXptlIO/WpDJHocXFUPUfFPWZVKhcGVeXVgn5DkDkZcEWUzE+S+fpezVi7fFoJkqaYnqJv4Jx7UeyiM2c6favzDhCRB8VRdJZhS4YLLkXh4S4o2E+QpaWdFo03WbRsg3qafjQql8YOPeRQ4jhCDHbs3JFPYmoqdHSDmTE5OUm1Wp3n6c6DrLWZzKLpayXNUlIvSKNBHMdAvk+aZnm98z6s0vxix84RmhM2EUOb6h3eApnPOp4rA2IXPTZChuZ3IkQkNm+PS312YaePUhzHeXbDhV0EBL5tISyIPWyHiv797onxN9Xq9Ruled7WDQ2TxNNh+JPksbUHGtzHof+Wmn9jN2XPJ5gRl0psXL+B+JD1VO9yCOYD5pc1UvpARL4iyMhekTQxw2npSWBHZSF7FHDz7J9DCAu0zQv65khE/1eM54D/EEDAmqP1LU+ifNfBG+lx3kgeox3frZJsOBDj2vm/C5BZSiMbb7u/iFbiqPKAbk1GM7vWm56NDM4yNFf+fm1ONO/obBDhOTh9D7B4QoUVaYs+VES+i7e/NAtX5+9uAQs00l043cL+IkMkAo3GeP4dEkEQqZTWvy+S6LlLOYFWCjMbjVz0CRHZljbSt/RbTmFwFxQUYBiRc98rWUISJWgkNOqN+a+zO6N6PwexwbXAmcAt1sbVFEJgfHycwcFBIufAAjQ9xPNpfZxa2rXBDJ8FduzcxYb1G3BC09jPVTyc5qEDqizQnm69gCMXEbwnbqfogqmoPqHTy9rMHnLllVf+Rwih7YezVCpRLZcXeFUtP5ZzN23cdEPkoq1LfQxUZEN9qvbksV0739HKLlkulUCkNUnNYhdd7lTvkx+vvkQsfAH4U7/+KROltGEob21feu0tMUTuTj4ZcaTPpvSJAdzTiftqZv5REHa1fgl4BF1F3+VtDlHRD5jYeLDwWTB8yIgkbnW+LyKfcHnPPooeTkPtvj6rfXF+R14MvNXzB7xdRIa4Y4TK7butKZj9OI7j3cB0p3w1MDPqaYeoDOEpGG3DoVYLMU6INP5UEg89HGuFVRkijrUv1jKDmVEqVYAyZg4nydtV471mbM8m0ujNSZxMNNLGe/vaf6UbVFBQsDq0cfYuYBnfElPVp6lKHbhoOtY3T95wIqovQuTxiCtF6miGXN+sTp9YKpV+0LZAgCzL49b6GPIXgThOsD5SmDtVQubZM7EnH35UnZbRK5VKJ5Ti0t3btcjMcC46/uCDDz7KzBZMcBNVJiYmqE+1hjfn7I2IjJnZb+hikp4Pgc0bNz51y4b17wEaTh237NzBpVdd2kzvbmzdvOXPmzdubCXcGUrUvbJRrz2tF93uWQeX6wuNVFCLMOnHG2yIROtF5DOswCTdfhGR+8Yufl+tdsuTGtl4cyJVIElGKMXrFpWdK+gJjVz84Vp95wX1xtjFAOVkPUk8hFkIBt8W6d3gFgERHoLYAhlOw4jdAEk02DZUyMROpYeYEDH7hptdzCrY2/mkRN98f8zMJTAznOiDBPnQ3vYoG4ZqcnKltPE/yfxzph0bNL8l+03PtOX4UCIt/wNEL9pXHQbDKCWl/4wjd7FJekavN1NhcBcU3HpYzitUgH+Jo/iZGD/FuCSK3PjIupHjReQBNi9cRVDSkH1eVH6WJO1DdxWIuuklLMJyYnPFOSbSjMHqAJkFxicmGB0eVS0lr6WlrdUGVanEUXTvLMsubdeDGRocZHTdus7tFc5HeGg339dgdozB3QzOSUOgum4dxwzPKfu62dktXRQ96aYbdn7g2muvPb8fT52ZcfuDt3Ds7U4gnepvLqGovBHZ95KgAn+vLv6Os+SzIrqa+s23acysGkfVtzrTvwRMJY8gaapFfAPs1SzyPHUoE6flk12pVAaZcyOKgPcptXT3wrAwgSiqPriHrIk7Qc5qbb6a3m1RoVqtzPtFtin6EcxKq1LxkhiGPDuI/2m9sfOzkHfkncYkyci+aVJPCGk6RpZNEkeDB1Urg29fA51ppxp9wLB7GdmOXj67hcFdUHDrYSXeRGWEU4FTRZRyqbRAjURFueGmG18tTl+/bt26tolgIucWlasIIdzXRO5jZm/Vpve55SFaOQwnSqVUopalYEa1UnqFqv7FUprWcRTfLY7iT3bYoDlXvl24Cojwyx6OQ4C/khDOaf0hs+KQbV4ihhBCtHXT5lesXzf6mG4rmN1ucY7NJx6H9xl5rE5vCHZn4Ok977gKGEYSD70jTgZ/QFNRIw9L2ucf5FsZhmryF1rSU8G+jxhptofgAwi/S6KB34q4E3otVYTD0iy9i/f+nPkd2+BriCwc2RL0AODu3SpSCHIeItfNrFidDpkZTNWm5uiViwgDlepbyBM/7VNEo9dmlp5uIduDCFmoE8fDzfCStdtJNfOYeUQiomjgRWArktht+cjRoK9C5AU9dP4Kg7ugYL+hOe9lEcZWusr5xnaWZde6KPq3XWNjnx8aWSiB29yGa665Jlf1aJsV09i8afMDRtate0OlXPnV9Tfe8P2pyUlGR0fZsH49K/0BaB3DYHXg75zTV8+P+267D5zQMUZQhdpkrWNyHRH5w9DgoBfpzusnyF8Y8mpgCvIJjjOjAnKz6FzpwjiOHxGrO5FeEzM0De7SUIlg9SVVZ9oUgBA9d5lqJJ48O94EebKN9fToHZ3HVsz+0cjeMLPKsYYFuFa6YUZ+TufppeVzg1eqEgF8kL+ppfXvC0LwDVQ9YGnQ5JuRizo/L50abqaYPAj0nNl2sAFxNECcxO0Gx+6H2XBXxrYIaTr+jczXpjXES8k6RCJW3sgMuMhw05fXEHH3B33SvjdoDVV3ZCkefmqtdst7c7nCgPc14rh92M4aQCEfRSmXNgNscuqetMy27gF2kz8vo3Sp4d4eQ4meXm/s+S8fGl0nHCoM7oKC/QRbIjzDYNdqyj0ZfHlsz+4XVyqVq5xz7T28ZkTOsX5kpBn/3bYcyqXSvc2McpL899TExEm7xsZuHhoaIo5jsi6yRHbd5uZEzHKp9Oy4MvDeEKyrd57A4ZKnAr5l/m8qyu49Y+zevXtBh6JpEN80NDhwi4hu7vIDcXucO1pVf9MshGwmbn0784wpM4tN7F8y75/RTeGzCbUGk1fdwNAxt4PQ83keBXlUrzs12RUsvAs4XZDtYuwxYQjYiHAnM3uairaTaVwCQdDnGOGDTF+rFbNpPSsfLLqyetvGtWb218iC5FkmSBkJVQscKiIPQuQx5Jk3+6jGEJEHJi4ZFnR3UCHzezATvG98K3KVl9PHiY+i+CEOe8OsnDrkutmeer22YFJK7KKHzE980rHNZlM+yPfNIkKebhBBWXkDWEACSdJScGmtLb0Ss+XcjBcY9gmBC0A8cFQI4SmqekqvBZkF4njwBSLxJ03YjRmiK5agbNWeEzNP5qdwrvxQiDb2ee3ODoT3iskvgV0YGcIGYKPAwxGeBHJkz6UKw0L0T43Grpd3u0thcBcU7Ad4H1rxwR2NbkF2rVL1Nxv2ch/CR7vZOHYRG9bnUskdOgCVEMLtzAzv/RFHHn7EJ3zwjxGVNOtnMmAHDMM5V1XVV0bOvazHj8sG78NGM7tlQa8h82zetIkDtm3rtO+e4MPVZt0Nf6qq7BrbdY+dO3f9BiCKIg7Ytq117ibJE1LMjaEX/Rt18noTrujloMQHrJY2J2X22jmTY0EO7HEngIw8Ffa35q3fDVxrZr/x3n9WI3008DHyjk6nNtD86KbARSHUfyDqfkCernyl+Wfy9PIryaJZZfugjvELIOt8OQ3DPkWw40XdV0GO6KciETnczA4NZL8NIeT5GhV8aPzCzP8Bccf0bhDZCY20cWgI4YrZzQ8WcjWiuaNRFZzcv+uSzX5puMtUXT5f2Cki2sfITrf1zdjWgp4Ccmp/JQkC7wvYi5mVjMbMzsl89slI4n9Vkf+kxzk7ghweReWTzTi9WSIr1Pl4AXk2xpVkCgDzWMgQZyeL9DUd6GdmPASxyXmnaxfIn8B+lmaT/+W09GbV+Nldno9bgPMwvu0DZ3TbAYTC4C4oWPOYGYNDZaYaNbKxRvswDQynbufw4DJGyeYhuTzdacHsZaJ6mXTxtosA8RnBZxjCVJYbd7NbLCLDSZxsbh1HHMePSIg/nAX/PFbQcBKTB29Yv/6tInJiz98VkfKeyYnRLFuo520YcRQxMjTU6QuQgtzctWSMGZGL71kqlT8CNFUO5uy7sBKRQef940kb7+hFmibUGzhoxm72rP5yfK87NLncjO8tbR/I14Nxo4p9h/Zyg2Nm2S9Av4PYDwX9tfd1c1KZVXSuZrBCXM+CFNPLxzC0+d8KIEAZaz43i51iC78x4zki0Xfo7ySJYetzuUyHMpjHLBtZFsK34sgd04dBNOhU7yvCFa3nzMyINSKKo/mP1/EYXXcWDPtOHM2YOC3ln5XHEC/IbHNK9RlLJU1ojxBC+pUQ0ueJRqjGzH78BSFYeDdIVUXf1HPpZn8hIZw+3fKV0a1flecEII4HkXhIwO7Ypzf+6yJMLu5csF3AcwwmBV7YYaM/gf3YsO9KkJ+ayvXQ+6T+wuAuKFjjNBopJ5xwFIcetJUdO3YTRQtDXpsa0GPkcWrLtroj5/64fefOVyVJ/OVSqbsJ9jFzv+IiQiTKLbdsJ80yWsldXBQlBxxw4LTH1vJJiE8VkTsZPB84u7W+F5pp0UVFTwV5VhzHj6Vf68uM4cHhtt7cPJ7VMz7Z3llpQDkpTcRx3NUxBDMGBqonDg4OOMAbhs317LXRRjNM5QkkyX9qHkzbFaIOP1nDMt+PNXBo77sAuXc+ESxtxdIGsWmDMz9HRrApDM4zorcL8Rubh321mf3UhO+I8ZM0m7oiigbmDNzPZUFnZTmsWAz0fFbI2J7L/CjueQgOgvwQx5+Ao/qpIo6SA1qlBcswy0ekVDndzP6trzJd/DAL9pmZdgqZZdTqNaYPyIwoik916ro9cQHku7M7o7qa2RVneTkNtojIQ/sqRmRHmk68sJ7topyMErkS1kwUJiJkfhKfTSKib6+UNv61SnRiT15qkQdn2CBNx8ZyJk/MYlWeEyeu+bawCtDPyBrAsLc8S3DkIgwP6PSj0uqABQko/pWC/iVwOyAFuwDsh4Z8R5BfA7uXfMiWoDC4Cwr2A0Iw4iimFJdwbQzuHNtp2A0sw+BuZku76vobb3igi+Lroijq6vUy39jOm2MkpTJD60YYGxtrTlwynHNjwC0icuCcSZnI3QR+bMKPVPV/oyj6NnA1S7tiR8y40/DQ0MnOuUeqyEk9HPIiWLXdWlGlPlXn8iuv7Dgp9OADD5oYbcaxd0MI4ZB6Wh8GdooI1VKVPDGnWegwy9O5+C43br/p7mO7d5/Xbey+hUBpbCd3ududcZHrtVPTXgtxaQ4WeJVhL1sgEyGgJqiLaGTj1BtjqET/Xa1uK1uwc33IznEu6mIysAGKLCtkdoka+vGwSf4/c0Z4WDJjbP8EZh5EgRB8M7NjCcvFqDOBa+jT4GY6tMnypJPNmdyG/RLsjyBdJ6RpYYT7mfppI9AQQpaRC0W3DG5EkFPzCX9dTHq2cFGw9LczxpFhxPQy/N91+83wwdMy4VT1FEE29lpOPuG89nUjuyqJBgkho56OUYrzsHsjUCqXwUqAZSryCeDEHqs5zLnoeJpOjeVItnZiJZ4TmZugKKL/b9pTzexrwexn7eo0gyiqYqRAfcqInyfEJ2TZ5LdU3cWqUe9JIBahMLgLCvYTavUaU7XJth7uJuNxklyvqv1+TAGwYJ9qNBrXDcbdiVG0NbZnSmN4aIh1Q0NkIeSSd2Z7LISfmdlj2+zgBDnVOTl1w/r1ezC7BNGrgUvIY+eC5Ab4MCJHOOVAhCMRPWywWm15uVcE6aAhZsGoVqrc6Y7HLLb7ZDu5xI51iQyV49IBwM4QPDdtvxkwnIsYWbeurXVmFrRaLj9BzHoyuJPhIUT6it7sf8Kf8BJB743JJ8B+DPxp/gZxvA7VhEa6Z4dZeHV7T1LnVoutqHd7bq193lc2639b5sSqeLdbzDt8s5Ab3RjOlfLJj8jIMmoYn74EJtMPvsCUYd+TPgxu0ENCqN/Vh8aPW+dINCKOZjStJe+03a2b65BLjKb/V2+MpTLL4C6VRoi01Pe17FhX8PkIXtOAS+LoQSI9d2YxgyzUPu+tZbxD8IZMR9nN9a56qf0wdtXZXayu2tto1G+X+exsgCROcs/vCp2TlXpO5nVIjf7fPVud6PfUyWeBLwG/BnbN3UQREjAPEr4LfHe1lGUKg3uNk/lGLsblEva9vFDBvsLM8Bbw2NwJ/fO2ibCru/UCdSojTqJrjjj0MNIsnVOTMfeFamZdjSWGEPDek3lPFEd4C6boOyKRR7P4qOYQIncF7gqALPQLzjY0V9LYzsvu7C4NZqSNzhM8oyiKtbf4yJI6d7CKXpSmsGv3GMGMJEmGRtatm59NA2jG9g8MPqg6MNhDQLZhPlC/YTuVQ7ZhWU8OnJt72Xghcj+E+wmyW5A/NSf7nU+eHvwyI4xFroK6JNfYUIGQErxMTxbO49vn35WQb7BCA+QzNJUSln9f5UEzeTmrZnB3lA01zDKCJYAdg8gd+q4i+Otmn/5s1jkXsa854Xk9lykQgj3YZ1nT4DbUWR6/3Mp4i95fxA10U56ZkXm+LQxNvx9EBKfJikvg5dFQGU7ruVgJmjiXKzD1UdrNAr+OdK6jw4dGW0+0iF6Dq1zfy0TmZibMw1vvJhVdiXOy4s+Jzr2R68BOYEs/ZYrIsCDPAZ4juGsM/iDYeeTvnV8D1wKNvMOumHicK+ehTVmeUdiboOJQlemAlNmduW4pDO41TObT5lBVHnnkCqP7Nk0SJwxUKouElICZXbr8F5/UQx4zmb/oWymBnVJKSjjnEBEqLiJPqN1lqdL0GQfDSziXYM+PXfTeNaoDS+bDDmtzdCLK5OQkV1199WIhJZXRkZG2SYHa4VS54aabto7tHiOOY253xBE0O05bLXROwmxmt8P8kRiXdH1gaQpplqd37kKTfBrhmhWSnRwGTkQ4EfhHVAJwo8AvDTtX0DMNuxjYld9d1gwvMJyWpr1hZiDNv2V1PmUHm9mR9O82V3LN8ZnkRdLqPCy/cbOwzsb2DE5kHfBuoG0Hrgv2oG7O5DgXZnXYjJ+hdgUih/VSqJkRRZVTnau8cmZtQAjT7x5BHtJDeVc4587XWSnWVy2EBwjmZ5z+2FbgsF7LyOOzs4t9SG5u41aglJTazY2eALuZHuObnbgTZyJ1VuRGPGgFnpOdzOrQz/smpCJyE9B3R3EWB4lwUEtBRkRrwCUgvwA7E+RnEC5BFGzGcZXPM3KEYOAMZ5CGRvP37t89hcG9JhEy38CHlJbbwocUBJwWRvdtDTOjVEoYHqlw9bU3Uiq19yvnGRKjX1fLlb69DU6Vm27ZfsBNN93c9Ni0Xjozw5lxFHHQgQdSiaOlDMrbkStbTJLHjf4es8w5R5pl1LLsfQ0avlIuv11VB9aY4R2891f7dlkLzZPEMbc/qnPkjnOu3EtIiZlRrpQHg+ReXPO5sWFm25ZQIalI4G4q0rXBbeJIr72J6hEH9/YmMTnXhAYsmkS0HxTYJvAX5AsicgXwC5X4e2b8kOkQlLnD6iIxIWSoaC9iLd3yThF56zL2dwLvBf599soVVsowhHQRUycC2aYSPQbkX4Cj+67I7CJv4brZ6+YZEBMY30F4Tq9lC3Jc6iduF0J2GYCTmNhN9wuqKF3LAYL9QJE5akezk0etLEYSDU13DDC7g+Hbzv1YtBQzROTSqEN+AwjtZDy95AmkGuRe4D3kcnrjGFPARLAwoaqTZjZGHiO/G+QPvbZvCd4iIm9YerOOOIEPkU+Yn8Hm/OscpJd7oGvKwHHAcag8HagLepEhPwa+C5wDNt6uL5FmDTIPIt1L2xcG95pjvrE9s977FKzwdN/WCMEYHq5y1xPvwKV/uJaBcrntdrkzWn5vZq0sfn3UFRgeGjqyUqki5KETV151JXv27AFgeN06BocGcCIEmt7tWZbOtChbrqJxJ4EXAfdyzqHOXUawM1T1y3um9vxIREItSz8YRdEFqvLByEUn9NPmVWJXKUm2d/x18SREArK+l8qCGUMDg4ODA0P5eW96dkVk62KmgqoyMVW7/03bb/5ctyaFBaMS6hx1t8OYDjztbs9Lkmjod07ju6yWlvEsDgMOc678eLA9Zna2GZ8xOI1Z2sSt92CwgK78hLhSc1kO7R/WlULYJsj/IsyPbzJgnXPJwc6xHnR02d8M4ds6L9/6gv6o8A2hD4NbqAj2AMxfhoChBKwZc87dFD2467JMvr3wWVgtg1topLvwTbWWyJUPjqNqXw4PQa+Oo3b3sBFotNvFDPcPSpQCmZnVycM7GhgpRsh8RpIk80qbXeeKsOLPiYnlkpNNxOR7KvrSZdbRDSWQuwjcBeEFcVS9Ilj2XfPhY2C/mG+T9UphcK8x2hvbLZqebgqj+7bIVK3OZK2GRos+6H+ulsvXONXb9xVFCEQuOmJychIzGBgcII5nPOpJHFNK8olHHgjz3IoqgqqDEDD4WgjhayGEu6jo30RO/9ZU/kngnwaq1fOBj0c68GUfOG/3+J6T1o+MvhyzF9FnZ2ElMfhjyBVf2qLCYooHFaBjVpyOdRqDWMijJ1rPv7DozEwzQ1RvN/+juhR+bIJ0127Km0Zyb3p3ZEj4CPDBnipbFgYwJCIPE4keBvZisJdbm4Q0TS/h3mtad6x0Br75VBEe0fnn3uNMOzAuxmfnr5z//AM/dflo1kG9FG5mxG7wYc7Zx0AIlpKFXHYzcuVT6XpioGxH5CcLP5+r9a3MI46x5twCky39DtQZ4bpO81Dy07zgNwP+3F9ta442sXuzXdx2tiG/EORue7NRiBymkjw7UXt6MPtk5rNXsIy5LIXBvWYQMl/Hh4zFe05FeMltFTMoJQmlxY2rDJELDfpQC2jN8Pe337HjlnU+hLG4nMwxYlqp0hdBgSqqXo1aI01NlF+B/cr77HXiooeYhecncfIA4O4W7JWR48OjIyMfDsH+o9Gof6mcJO8Q1Yft0xCTEL4nLQHcdj877Th5FRhSZGvvlVoFhSzNGJ+YQFSTdYOD92aRyZdmRqWcbKpu25ZAezdY2/0yT1SDKK5g0svESf9pI7wQZFlKOP0jJ4B8E+xNwKtm/xIs4GTFJ04W5HwE4c/zBQ7dQjNpDyLfA3t6rxWY2L3TdHzUgt8ZrIHiAFO0dGp3SWuEEBpnZtnk9rnxRUISD7JaXu4kGpyuB7HN/X6TRfwuaxfCtkos8v7a5wgyv/PcAHsLyGl7vzUGkDjRfxQXPRCxp2L8tJ+SVlGfqKAXcs/2UsZ2C8H7DO+7/r4W7OdkmefYYw+jOlBBncNFnRcRzum3nuYs9i23O+J2dzrssMOJorjsvY9m/95Cm4sTmV4UORE4HbgS4dfOuf+JouhJURwdsH3HjkmfZV8zONkH/1AL4bsIByK8VowLBd4yMTGx04SH1xuNvzazS/eVx1KwHyhG20Vy7WjptAQ5gn40qwUvgDrH0OAQQwODdxDVw5fazYwtIYTREAJdLz4wcfnVTE5uZ3Lylq6XiYntE2k6/jwVt6L6tD2igrxSZK6n3bBmKE7BSmLYBYHGawINZi/epshCHR8as5Y63jdOX7rUhQgcIHBXESN2A5RKG0hKGw5XjY7vJoQpj47y3zICZrMX33xvrdK7REJz8UDoe3ROiOpOEtotSrKiEz/XsrGdIwgBkRSRDJEMJP0q2Bf2VYssD/E7UtDTgVP7KaMwuNcAuRpJpzCSzviQ5nHdqzgDu2Bt4H3gsMO3EUVKsEAwW2z5EX3k7Z6FNry/m/eeWN1bDz7gwP886vDDOerI2zE4MDAtv2cIymxjG1T4jc+yp6VZ+gYE75w+VZBPE/jDuuF131TVZ5AnhfhegIebhVMN+w6wSYSXbFi//veCvEdUzg8WTqjXai8LZjfvzTvcsF8H5OdBlPkL6phqNNgxtpOdY7sWLDt27aDWmDqxr46CWWYh4FRwsUOd3IPusrgN0aPyhERKuHkcP1HHxOYZKIsvWVb7v8xPvXo1lR+65NkivG72il4mqhZ0xe+Ax4Ltbom25XMLwPsG9XSMerZr1jJGI9vzE6BjONZilKLBh1TiEZxG1NMxgqX3B+lqEqKZ7VEX/SgpDZGUBucs+fO4OkZmazpHc1nGhGKpz2g7tltWJiBh7RvbkF8rR5oGssy3FkvT9Llm9rt9HDo2ivAFQe7c645FSMk+pjfP9nyKmO7bEvV6SppmOFU6C8UBcDGO3wN36rcugbsIcrSK/NPg4GCpWi79zMR95padt8x4uQ1wSr2Rz2FrhrpkZnZlsPAeH8J70kZ6n3Kp9KRg4a/L5fIjzeyRwBtN9DSDT+LDGSacIdgppvpiFXmEmT0vdtE/YuHzXuSdZvZZj/2riv4zqzwJzanjhptv/NCNN93caP9SN0bWrWPThg34DsZdHMcn9le7pBhM1Wp4M6rlyqO7/K40tfN6qUoI9RR/3RjxUZuw0F3/TERJwyTpVONNldLG9UlcftG+DP1xqq8KIZw7WZv6jjQngJZLFeJo5ZJ53GaxcAaizwSuWPCTGSF4cj1nmfdb2OFDekbkkr/vOfkL9sB62nDe17yIR8we0u28XjP7uTeunN8eRVZRpWTvIbh8lursk2Etz6shOktTu2mjR0SYefpJxLPvERqN0OxEt65ftjOx8LhSnHxVxR27FyZvd2JDOSn/Twjj983CVK3bnQoP9z5kRmd7OS8DaXq6G8ssp2At431gy5ZRjjzyQIIZzmnHRZ2mwFnLqU/gpDiKPgyUQgig7uMGL5nvQRQRpmp1xienMBGCCBo5ojhCzHAuOjsL4Tm1eu3YgP2zwfkiskXgnxV+LqrfF/RRQeVHwcIja7X6KRg/EpEy4p6WlEoXOtG3g3zZzO5mZt9fznEtRQj+uuGhoS8ecdihHH7oIQuWww49lHK5wvjkFFO1erslVtH79Fe7Zh7h4j/8geuuvfaYyLkHd7ljy79G9wuIKullNxEmmo61Rbaf/bGWXEYC72svDmZPM7Pr+zve5WMGqvrWcpQMll1MOYpR2A+Ni7WCAOwMIbwqTSceJsgV878rIoKFDPO+eXvYvCXgfe1r/VUvd0bk6CgeICmtH3audL9ur6XBN0V0Oi34dHrwVfeGzvFELyfOc3GlDzPECxJ0ZlnC89JuFKqNvOCaRCXP+2DNEZV8EULwl9Qbe04J2KfYh15GUblrFFWfi3XvAyoM7n2CzAojWZny9oHRPbS3KrrVIwyhymKLB9atH2ZkZICJ8UnqtdriS6Px3eUMu4nI0SLygFmrYhXesn50/WcFOWjets0kLU3niyggx6vokyPnjlYRjePkRgv2gUajcY9bdux4sIh8DphA5FRRTlfkHEGesGts7Mx62njgzl07/84sXCT5e/cJKnKuCK+dmJp8v5m9n1xvdkXJjyG8I1bdWUkS5i/lOKYcJ4yOjjKybl2HZeR4VT2qL4NPbE+9UaNarbJt67YX0b3UVgqSLT4cPX8h7yBNpZTCMAMDW6mWt7RdKuUt05POrPlffr6UENJP1NPJu4QQ3gTc2PtBLx+n0Z3V+b/Kwhje9pD5PfuiGbcGfOZrH8z81F2busodUqkaPghGmRlFuJlFpEwIeqYF6yyr2ZkkjksPNPFkfupudJ/UpW6074yvtr09z8Dv+70UQoizkNFpMb9y0yb2B6M7zysRE0fx9N/TiNycZdlTgmWndrrue6N9SVx9frWyvmsh7iKkZK/TSWd7+eVOh5cwWzx/VTqAIYh80HLDq3AlLQcRIU2v1t1jS34ZZDJhfOcuxifGSbPFQ3udurPiKLpatXv92m6Io+iJ60dHT1Z4RxbCB4Ea5HrQU1OTZN4zODiIiI4DbxXYCnKxc+4bwYfTnNNfxkn8g2D2g3q9cWS5lDwReDJwLxW518aNG14iIu81q/xPmqVfiNS9wOAVzrkNII8brA4+1rAfYPwI4X6sUMdPRGg0Ghdeec3V/x1CWCAvZ+SShwds20YlcospJpwK0td7VUTGfNbgqCOOPCmO4yf3EI98A3mmtp6wRoPqUYdQ2bqVkGV0EvgIGJErk8SDZL5Omo3jfZg+B2Z2gxFekWZT74tc9e+AJ4jI3dhLDp18om/y5DSTT4fmxNY1xOrqcK8sGkL2edXocgOQ2WdytlIRhKCIuI6fMDPbHiycqaKP770Z9kgL6ftV3QO7CycRzLILG/Vbft/u11JpFJVkpRMOTZP5ejNjq6Ea7XSuX7PKBqVDEwVbsUmTqxfNvizmPSczrayUKmTB47OMzGett05zO/uh9/6HGPePo+gpwezhItKzJOsyONg5fQh5foAlKQzuvUx30n/9IviQEchw5nAsjK9bIYKpvCus/U7yfoE0PG7HriUN7qRaprZ7N+Pj49SmFpc/Mwtj1Ur1GwMD1eeu5PC6meHUHWDYu5zI01Tk/WBfMWR7CIG00WDXzl2Mblj/p5D5e7ko+ihmpwLHOqcvAT1neHDoS97709Xpn3yw1wfCOxR5osC/Rs6daGYfL5dKL8XC+2tTtf9Offjc0PDQmy2Ep6mKYDy4meijgweud0SERpa+YnJycqpTuvZKuUyllCDTmTfnlQEO5LH91j8xOXnTzTfdnBx9u5EPebNuJkvm7U4b14yN75nq5YNs3pMMDrDpzkdjIY8L7XSXzHi0HUk8TBwPkvlGHk86SxXECNcL8q40m/hPEXcP1ehhqtGDgRNYVW11Q8TdU111G9j1i+ij91rsx83sV0C/WoOKhF8h8ztOLX2fNYfE8eD/C2Q/CeaRqIS31ijsTHtnDB7raLkZ4L0/3Tn3+F7fPwL3iLSyxTl3cjf7ikCahf8zGwjtR/VWUypSyLKJ/DzlHs/rIxnuL/GNuG2dPgES5j5rK0Fuwq/At8H4lJn9nOU9J7+Z+5wYoBAikNyhk5QrBB/IfNactDJbp5uzzOyszGcbVfRkp+6RCPdmGZlVu0OA8DAKg3ut0a3O9vIxIBOPJ0wb3mu0V1sA+e2guqjBrSLsmqwRl9dxuyOOIomXfreZ2RfN7Dms8A03Y4DJnTH778GBoVca9rlabepzKnqhD8HMe8zClRN7dj+kVCo9KYmTF4jIiWZ2HzO7j6q+Nlb9QQjh04p8M/jwsXpa/0SlVHmSc/p84ARE312uVl9cgvekaf1FWeY/WUpK71fVY8nfXSv2/sq8/5g6982jj+78fk7ipPnJay8xJnBP7TMxg4j4sbGxxsZNm/7bRI7rNvtjPuya/H50aKSn+rKpGiN3P57SxvX4Wn3pHfLaMAv5ZCxXzgNMLKMcx6CCWT5xWzW2EPzPzMLPDF6L2REYJ4jK/Q1OFDgG2NhTg5dEhkvR4HEG18+OU19ekXyFwLeXU4RJYEYwKL9vxFbUALzZzF5LPtIkgBfhPiDP6KcwwR4h2O1E7LLO20ApiejiHP/AzHYBIz02Y4MZz6bLXAJmZiLy7ShKFjyWQjNUbNW+fka5NMp0xWY39O/gsENaz9fCnxYa2waIyIMReQDCdmAS2EGeiXVn8+89wG7yELwGudWespLmgPC/BL62nCIWPieaTxKdvU0zsVUSJXgibDq7rOVKSxiquj2EcJqip2EMZn7y9lFUvY8g9wROJM9g25Oi0xItR9Dju926MLj3EstTI+kPw8gkwyOIVxJ1hdG9nxJFjj9ccSOXXnsTcaT4Lpy7JpzrcBcLHLvc+lueo/kfEwOiSA8C+XdXHXh+pVz5RaPR+JYg30mDv3h8YrJeLpc/nfrs01MTk48eHBx4uoo7FWFE4PFO9fHAb0A+Hln0WVH5ZBb8p0TkhU70JcDBAm+Po+R5kbN31uq1xydx+VnOyfNYuffXpeOTE//mF4mRjOOYKIoW/UyJyj/Q5wMeQki3bNnyjkjdcb1I26kq119//Q8mJqe6zrJoIbD+kIM49A5H4uv9zfGyaaNWEFEMw7kyRoZKjEbJ9Jbk2fD+bGZfRYQ0Tdc7545VkROBkxC5D3BIXw1pIiLUGrWD0yz3yJZLZSK3bKWSijjJwwVWwn43h/cBlVxQc0UKNcYIvH/GAW0E/LeV+PH0owUPVTX3ZEP+Y3EnTSv19qLHcL2KnSUif9lrI6LIvYDu23+JiFzg2mTgleZ/q0n+LIRWhX8QtAG9yQPmCccah9Ybu1j4CjFoE2tiZpSSkX+MXfzXrYQ5894BGY4UXAPIRGQnUDfjWwIv6aV9S7Cizwk4hJhOr9LWuyc/1jx2XgU8uWqOy+cQYdi4Wfgl8Mv8VWXlgN8m5u6CcIKY3B/hLiCDy2x41++uwuDeC+wLY3s2osaOXZ60Boce4FjBuRcFe4k4Un520RVkWaAUd/fYSu7J+BTw1uXULSJMTk7+wrDrB6oDpwKV2YZM/k9DRJIoiu4dRdG9zewNSZRctHH9ht+oyE9E5JdRKfkextdr9akjXRI/JlL3aBE5DjjeqbzbJaWXGnxRkY/4YO/0ofE/kbq3ucg9w4xDROTd1Ur18izz7w/GK1TkhcCW5RwbkDay9FmiujPqYLCKCHEcL6HxbAdFxH+zjHaUVeS40GOmOTO7sVKtnO1iR1fvFzMQ4YBT7omUYqyxUhO3KYMdBnIEwonANRifzPUrF3zMdgA/aS7vMWwdJg9V1VeZhb6kLJsTrEaiKH82BF2usT2N6DKNCRPEov/f3nnHS1KV+ft5z6nqcPNE0gwzMKRZBLMIKrrmgLq6ZnfNqChmWfWnCKuoq+KKKxgwgJhWXAMoLuCaMICIWVBAGGCYGSaHG7q7qs55f39U97194/Tt23cCnAfbD9yuOnWquqvrW2+97/dFNMK7XXhJKUTtpR1MgQF68AzloluAaKPClQLPb2+68q9JOvwRr9nwdGJVVYmiAkZm1pWKXi7MXnAzi5sFRf/PGJnGmm3+r7mCNG/mDpS7gcNnM0a9DuHYOOrpBT9a9atAZMvIhG6z9bPKCLJ8hu6UjaeAjYjuonxl/dn4J2gdyg3v0HkCBmZn47gEWCXIEcDxin5WVW+DhjgfHasKrKm/voUIma8dhfqXRLb0dlovUp9IyzdXQXDPM3tbbDcQgXUbHdbAsgMsLvSH2G8wYtg5VOW6G+8AlCRtXSSJyCXFKP43Gj+2bSAiVGvVXznVN5XK5aNc5p4WWfvMemFcd/7IljwPeOyHXIwx97PW3k9VXwxod6m8SVU3l8rlm7zXW533vzDGrDciJwLLgYME3ixiThOjP/AiF3j1r1Lnr7LGfFpEFqnqYdaac4FbUO5CWMyckjTlDOf9T+007dMbjzFnammvqhSi+DRgQfvzaA8RfjSwYMH2VqPbrlqj9/7H0HvY8naj2xH5fq4C7gdyFPCA+sVuKZjuuhq42+P/BxgWUbyvuzlM/Tu4E/TSam37T+O454dWouPbSQEQpCCjod7OPstrfAdmvZ63jLvMipBku4htz7TrtI1XjEh91/USNdKW4BaRwwR9mqi/dNplyC2J6s4+MxRP8kOEQebR1UrUfG/aj1uYMjrcsW2LkLmMLE2pt7qsRlF8QxRFh7fxfVnpNV2t6q6HerWoALaMYPDe1XPq84MtyCGRjWd1gypiSJIdN6TZCADFQj+R7aJTLeU7cp5M/1PWAywFVguymjw17TgxLAeWmrpK9/iqJ3svgKrB+wQ73Y2h6i1pOvSeLKvdUi4t+IKqb0cTt7zDQXDPI53x2e4c1uSiG2DZgRbvQl73/oA1wo7BEYZGEopxhLWzKri6R9GvCvLGdrevqvT39fWmaYrLslvSNLtFRD5ujT0K9MQsc48X4YTI2iMnfp+aBbiqHkAekb6fMYIZ08kTk6KLIvIsK/IsVbnaq56ZuuzBeL2kUCicXB/zqIa7XTv7lJvDpBdWk+QTXv20FwkRIYqiGaPbIrLUGPOqduYxR/zOnTs/1fIFznu6Dj6A7mOPxLce2bbAY4GHithjUTkSOEJgAESmrTsQlonI6cCH8/QDh1WLiMdai6jUc1DzxZ1P8aqbVP1nVPRTrU6uGadu2NUb+EQ2wnSqMFGpu1C0w+Tj431C6kYo2O6O5hareirZLlQ9IvLjYmHgVpHoyFmfIqoU4t5XZz67dMakElXE+yaRPyV3oforRJ40u0m0OlW/zrnaddMkPmNtAaGlfPM2t18vPayfCprfivxYVdt62lUo9P9rliXX5/nIBSJjGe1rJZAlQ2RuGFWlVFz4TxIVe2YjllW9RlHv36Iov+GT/G/tTHWKwTt5ngigBwJPEuR4IxwFHIOwHCjOlCZkxLwGsZ8D1hoB7xK8GCJrEW36TRDwmuXpXcol3mdvETEP6MDkpyUI7nlhvqz/5o6140V3SC/Z94ljyx9vXcfgUIWe8uyfeil8FuQ1qtrWI7M8ymuiKIry4s50NH/8FkRuGRwe+lJspLurp/dY0NVGzCpFV6IsFJGF5I/8DmJ6p4ppTxIReWJkzBPS1H9xcHjo33tN7zvjKH5Cs5Bva5/QaxKXvalaq9a75U25bbq6uqZ9v4EReYfkkZc9hojgvP/RPZs3/3Km3PNm1DmWLO7j0C4hq9RaPnKG6EyURzH+0fnu54i8V5XfI3L1xLmPN7lQvK+impJlI+ui4sCso2T1yNo6X390p0bzR9xzS9vQuYmI6UmzQWLbUsfylhGx2KgLn+9zVZH/FvTM9kbTx2RZ9iD1+rtpl1CFOMbamdN3BC430HHBLQge/7PUDe2c8oupikgfURS1WoPcFsYYCoWmCKrq/5EXKc66OE+Qf8myXeenLr25u+vAsWJJyf+vFA9QA1Toi6PuN7bx/V6fJMlNuX2mNLoDz5XOnicK3qVgzKHWmIuBWebhy1IhulhVnwluaPzYjeJWwCiCxZpifnOuuqVNuba51QWD4J4H9lWx3cBaWLepLroPsHgfIt37Ms57fva7W0ldxnC1rU/qpjiKvhtH8fPnIEBiRKZ8OptfC2RYVa8X4XoAX0/BiMQYkC6v2gdyP4M+FSOvQFt/xKyqEsfxKwf6B57jvf8/VV0PHNzujijcpar/EkVRtatratFj6m2SVZXpBK33nsja46K4cNpe6Gzo1m9Yf06eS9vaz7hHWLBiGdWRDJ+0FtVS1FkjFxWi+FFtRGO7RPgWcAbwOcZsCCZuAxGhVBgQMC9r51iqamKN/Zst2NGc2jl/Jop2XmwrquB8ldQN1XO5O5ffF5kCYkZvZL6B8g5mWcBXx5YKxZeh+ruZrmOK1ssFZ1qGK4FhOmwNWf/efK9cmi6TS0DnXDjbEtJcxC7cBnIVyD/NfiQdKBUXfclm6TNQv2m8OX5ef1EuLTYqfBrVI2Zz5RYRsqxyhfdDO/MnSxZmKE5sfcqdPU8Eg8uGQPhtFPdeq8KJsx+Dx4rIlSJyOsofpl1OIsQWiIx9sIq25TClcFOrywbB3WFSl+D3gZzt3TEpvcQzr1GAQHtYa9i2c5hfXv877lq/mWkf4c+EKgsGBj5wzJFHPVPbbcQhEjfyY0ulUj6N1r4vHhiqv9Y7l12dZfxvMY6vYBa51/Vc6n5r7T8zjXBrBWts1au+WA1ri1FEsTg56G+MYdu2bWzYsGF0283k7YU9Pd3drFi2/EOq2kGbqdbwqhdWq7VrarVa6+4kqsSLelFfQ31rFua5/4L7gRJtp70c9R4wn7Y2fqWgl4L8kty1ZLj+fgwsEYkeaEzh1aD/2MY2UNVbq0n1b6AY7JSf66wRPiBG3kjHjJxVLKUfFYuLzgYQiTssBgXvU7wbtXm80dqunxmJntBmSOX5mQ6/z/tsy/TXM8WabmTmXk+3A9cDbX22M7Dde/3p9G8r1uyZi1qSDONcDeo57ZEtf6ZUGPindlKGjJgT4ii+BjhT4f9krKlVAeQkRd+Jzv6JgSqomK+bqNhUT9EBnSKcLUZeSyfPk6j4c6/Z/1P0myCzFtx1HhFHhV96Nd/xXr4H3AisZczQvFtElgk8WUVPZ/b2lQAIXNPqskFwd4w8jWR/ENsNQnrJvk8xjvjr7etYu2FLy5HMiagqw8PDf64lySWFQuHVbRW1oHHzRTuv55n991wRnEt/pFG0RkSOmPUAOW39sIsIW7ZueV21lvxC7PRz996zfv36aSPbjbGWLlr8SjHmaToLG79OoKprkix776ErZuekp84T2RpJugWdRdW0ZrrRGvl6FPW8rt3mG0bkIdQ9ykXYiCFvgS1Egl1gbFd3+8/ZBMR9t1yyY+3tO6OzViOs7shIdcREW20908B0yhqwMTag3pP5WuO/EIm/aqPoCe3oehFZqo7neuc+Pf2NvmLIsLbIzPsil4HvqOBW+BVi7pl2i53c2AyICMYU8D6re34bBHMV6E9o4yajHrk/GriUXCDeDSRGzMEIR7Y/U73JSHxtIc4feEjdXaoDHINwTCcGaiAmHkZBTfp10cK7yNMS26HLSPxiY/XFQA3DRhh9KFO2YufqclWp1rZ9r9WFg+DuEPt6Gsl0TEwvCe4l+xZ5sZ7luGNWU2jRDnBKRLDWfFhVXwD0tTHAuM6HeRrJWK2jiGCNmTnyLYqJLOU4WijaXjShXUQEl6YfvPPutRfVaq01epkucmytZcHAgsMOPOCAj2R7+C41sra2c2jwlUPDQ1tm21HRJyld2ZGUTAlvWp+3qsdr9h8ivECVhbOd8xQcMPlnci4Xfh1RNRc3Mic60j1v3tDa2L5OrBWe48go1hQRO5ZBouqv8N5vFJFZCwvNiydf4aVwoaqf5gsjOJ9S8VtmvAEX7FXFQn8N2qsjmYYrZjoH9tSVOLek7CaOmzNmFK96lmAeBToXnbW8/pobIiRJ7SNpltYaN0+lQrHeOGZfRKsoVKs777G2dG4x7vvwHBoKNf6liMzN738iolxesr23trp8ENwdYF+x/msXY0Kke59EITKG39x4JxhLFLfU7Xv64VRvF5ELgHfN/sdLJ3d9qesFYwzOObbv3Mm2bVs56KCDKBZLNGrjnK9X2ddXF3i0NbbDnQZ3y9e9d+/Z3UIzpWc0jtnChQujIw5b9dnMZZ0Qny0jIuzYufPtOwZ3/WQ2qSSQzz0qxHQvOJhyeSE+m/VJvtar/5jAB2a74vyjnxD1f29EdcHsrz/Fc0ZRkjRpSlXRLaVC6XIj5tR20hsUHpz4yqOcT346rSc30HCxm3oRRdTd7DX7jZHokR2KqlZqyfYfqk593VX1xFE3hbhnj+Rwq3qqta14daM3Hqr+58XCwHlx1PX2Tubpt4OoXI3nEoOMOQTt8yeJABGoXCCYVypuntu0zw5Fh7N05OzZrBME9xzZ38U25DMfl14SIt17H+8xkWVnLeW6P/+VtffcQyGae4qciHz0kAMPek4cx0fO8kLUVVd4TXklEFnLSGWE9Rs2kNb9wZccsJQCSq1WY3h4eFzeuTWGBf0Dp7aeAj43BPCq1yZZ+hpV1UWLFo3OsxlrLTt27KBarU4rZHt6eujt6aG/r+99qv4J8zz1cYgISZp89Nbbbzs/SdrrDtm/7EDKS/px6TQ9QnaDIv9lsE8RMY9sa4B5QPG/U619SKVue4LBUGR//j2eC4JQKhRHzRgEQPmyoq+EdnwSVYqF/lMd0+dKC0KWDpFllWlEnEHVq3fJ920cPXKu+jfvyuh+qz6+PS8BmGpOYE1xj4htAGMsRmKSZIixqLvH+drZkZYeDuzNc6ZSS3acAV4jk7e5NyYeLQzfV1EgirpRVxmuJjvfWIh7Lqe9AuCOIwjeZ2eOpFv+Npv1guCeA7nY3nd8tufKRNEd3Ev2AnmHEOjuQhcuoNjbzWOedCK/+sDnxltPtc/2xQsXnVEoFL47ux9bOVhVuxgrdquLwJQNGzeSpumoUBXydrvVapXNm7eM6W2F3p6ek5YsXPTY2bQvnwsKd7gkeWHi3SAiLF68eJKgttaydevW0X2Y7rj09vZy2KGHPleVd+6p+Tdw3l9QS9N/a1gUzia6DXmEW33G8NAGfJt306o6VIjLLy6VllyD6oq2BukosqFa2/GSNB0aFDF5VDPuplzsXCOP/RH1ikrDcBGAXxmxfxJ4QJtDPkPIVoDeOfXbQhTFOD99qpYgOF+7Itauf6f9jn4ADfegHxgTT99xh9wmcc+hxFGZWrKrKb5gSZKdwy5LXtxVWvITZHbdJzs1Ma/u1bV055+UulZRT7G4iGjqLrD7DA2P8Fq6E+/lKiOlt8dx/F97+yZBENIsvShJa+cJs2tgFQR3W8i9IrI9FaGQci/hfZ7b092NLOiHchkE0izj5S97Jmvv2sKPf/xbenrmboiRuuwy57Kvi5gXzmK1Jd67AeqCW8mj1bsGB0mmSG/w3tPb28uivv7RvwmAMa/33u+pK+GIKi8C7mzMb6JQttayefNm1q5dm89RBGsnT09Viaw9UZHPee/22Emfp+tk53tou3HReBqR4PbWVfxdqvp8ge/RfiFTJ9jgvXuWqt7Y2CcRJbLl+7jdkuB9jSTbOfpkSVVdIer5WqHQ84A2xUqPaPRiQT44/WbzGg7nsqmdlAS8cpNX/ycReWg7k2giw3BVNLMzyh69NOet2YvEUZk0G6Y5t9x7d5dz2dNNFH1f4LA9NytQeK2iXxExo+eFsSUKUe+ooeO+jDExcdxLkgyB6idRVgBv25tz8riv19Lqq53zKjK7e8cguNtgfy2QbJXmQsqDl9rpa+D23JTu1YiAdHfDwoG60BYajxe8euI44swzX461lmuu+QPlNprfTKSapu8sF4qPp3XRVLbGHgKsy+ecu0FsWD/ZOq85VzRDm74ncqSFf5rj1FtCxKCibxTkWlsuMZXbdiMKv3HjxtH/FhGOOepoysUizudCrh4IOiqOoku9c/1TDDVvbN+54+yeYvHfmWP+fidR5dfgHwv6FRF7/z27dUHVXZ8klZfGcbnpca5iTTlvU70PR+3mn7xwMi4ubP4TIuZ/VPUs2vTCFuElaVb7uKqrTOdY4tUzk0OMqvrMZZcX4sJD5xal1L8akT/PfAFq2N7tSYRC3EfmRib9XdGb0ix9SmTtV42YB++ByVRVOUNFL2z+Y17g2UvjidC+jqrH2i5EquRXFn27qq4XkY/QMRvCVhHnffrhzFfeA1ZFZh+8CIJ7luwvPttzxRpYv9mxYFFMqSSTgkZ2TpGywBgK5SJ0HdQktMcf1zTNKBZjTj/9Odx881qGh6sUi3NOL7nLGPsmVL/WYnqEFZHRZjMNL+pCoUC/7WuOcJcLNn6Y9/5nSt7JC5O/Z5AXwZTat6OICMMjw5+sJrUvjKa5TCMS1q5dS5Ik496P45hCoTAquBGWC/I/wLI99ThTRCpJmrz57nXrLjxm1aq2xxl3I9ShNJj8/sP/JXMjj4ujvk8KzOZJyVzY6Xzto17ded6nw8jYV0kVCnHvjClB9yUiM6FwVFkDejXIs9oZTzBHe6092WXV78yUzmRtN3mzlik+A1VE9Ad14d++9lD5X1GZXIjRvAjaVsb6XFD1RFGRKOoiTcdHues3ijerN4/3oucaI6+cx6n8TvFvAH418SBYWyCOuvcLsd1AxBJF3XUvWsFl6X8i5ubI2o/DXGwSW54B4K9XeJeiP56L7gmCu2X2P5/tuWLuG7u5b6A646PwWi1l0aJ+zjzzZbzlLR9n69b2fbnHNqlf7+3uObmvp/e1fnc/wCKQJMtwudWxr3cWO2rVqjwVZozUe//mWppsTtLkpshYSvk8jbHRU+c04RYQEYy1P167ft3bd2zfvvsVmCzGGx0mc+GmKwW+p3C/eZjudNzunHs5qtfMNlcbAB2L8cblEmIM6j1RucSoT3W9R+BYFLCtk32rqr4I9GIR827g5HYGaYGq9/4KI+Zs9elfVCY27FCiqEwUlfcrITGfZGkFr81PYRVj4q/EUe+z2hEMilKM+071cc93pl9dQZSGB8Y0/FHRvwjygFlPoo5Xd+VuJouYvWN3l9/49ZFllekW2ZG57FWR2O8YMWcDbXU3nIwAutVr9nmfJe+P4vLwxCc9+1t0u0GerlPKf6tGd0mvUPTnopyG8GaQA+dl2+jt3qefNsZ8EkxrfrIzEAR3i2Sudq/M2Q7sP9RqCfe//xGcddbLOfXUf2d4uD23iWYOOuigMxYMDDzcp/4BMy6oisbRi52Rzxhrs8HBQcRDf0lxLmt+fJuJSCmy9hPVqn+CU7BxAYTV2n7RVkvkrYuzO6sjwy/1ziWNv7VDbnWmRwlyGXS2qcNutvs9VU5X9K7Zrzx2iV1y1CoOecD9WHL0KmwckSYVElfFu0Ldr9lirck7E/oE79PRNKE2uFrhalSfBjxHRJ4IHLy7lVrgRlX/TRHzTefdTWKmm59QiHvryUuT1KDQ4Zbic2S6Tq/t5ol1M+GgSN36Dd8stwH0alTvRljW5raeUqslD1XvfzPVmwoYEeKZi7udFf0B0o7gFlT9ulqy/fqZ8o9VoVQcINq9S8lc9M806QxKZJqj3NMtxRUKVwk8G/RUkEcAbRXoqPo7vfcXGyMXKXrnVDdUuWiNZ4pu72vnybhjkaf7jb+JEtilqh9Os8rXClH3PyP6LJATaOtcGvfbMaiqP3bqv2aNudL56i5rujvyPD8I7ha4txZIBvY/BgdHeMITTuS0057Pued+CWhfVAJs27p1SODlhy5b/gtVnfEH14h5eOrdKzH62eafJ6/jzwwDt1ljX9/f2/d2ETn3zrV3EUXxQ5cffHDBzaO7RxRF6ZZtW1/+99tuu7uRjz0H/qEuttvthtky9fScQa/6XjFyXju/Mw1hseTIwzjisY9kydFHEscRaa3uyRyBT8eeohiJiEwZsZI/pnXDJOlgXXi3Gx3UK1S5QlSXIHISIg/23t9PxBwuwoHkrZMjxosVB+wEqqp6J3CjINer6J8U/iDojFElJS9Ws1IGN6VpxYiiZ9W3vVdzTUTEOudurCX5LkU2Io7z9u4G8w2U28mPR6sYYJvDTTpGYssU7cTTWYdU9XXA8bPcToO4XCzJTDU9eRJWupvmQ/J5VRli1p+HWvA3lUp9w7tfNGolher3Cu9m9u1TBeT26d8VIttFmg6xm3M5Ay5V/KWqrBbMP4rwKJDV5DesC5l8rgyRny+3qPJLEfml87UbnNPtBTODzhSIbW/dg3vKw15V9N+BxbTbTrZDiIj13v9tql4DXaWpLlG6FtXzFM5D9FjgJJAHCXoEyOHkx7GX/HxpDOiBlPxYDnqf3izG/gH4jSh/Qf3fvfdY07zK3AmCezcEsR3Y19i2bRenn/5CNm/ezpe+dPmcxqolCYNDQ3+IrH2N8/7L3vtpv+iqShxHHxMjg6r6tbHgUf4TrqNr6j02zx38qKoOLl608LNi7FI/j7m1xhi2btv6/i1bt/5kLuN471HV4xAuR1nZoenNSJZl1wGnZ979Njazy81vCO0FK5dxzJMewwGrj0aMIa0mpFlG45ir96j3TRcwrbsUGAyGQqGfOOohTYeopTug/l6bbEb1MkQuy1xGZOMC0G/EdGWuEqF2iZE4RnRQjOxU1YqIZM65LXnH0tnVQglmTEhM/opVgU/vKz/fqjrqlOONz8vA8n+uFuTqWY9X/2cyfly5chPfq7/aZqZDWc/v303hqqwR+FB7W298b2dmN2ktDW4GpndemXEWc3t/Cv6q8Ffwn0JNQUQWgHar08UgBSAVK5uAmqpWELazm9uaiQiTe5c1kQAX7mvnyaR0v93v8Y35S1H1CLZP0W4RKaVp2hWZaIGCFytbpH4sBVN1rrLLSjfI/JbaBsE9A/c2n+3AvQNVJU1TPvCBNyACF1+ci+52IroiQq1W42+33vLVBQMLDlu8aNH7ZyqiFOg2yJejKFqhnvNUtQL5o+Sm7W9uWuWCrlL3JkT65rOYTUSu3rh584d27NgBMOlRcivHRlVZMLDggaVi8XuoHjIf85xA5lU/tmXb1vctWrhworXBbmns47IHHsex//xkyr19uDSr1wMwq58t1dz/PY57UBW8VkndMNKZyrOE+ndCVRHV28JPaiAwLQmwsf7v00fSZ819sph4V/21m/SiPfODFAT3lNx7fbYD9w6c81QqVd7//tNRhS996fJczLQhupMkYcvWrXg4Z9HChSuAV820vPfedHf1fBD0ud77DwL/k/dT8Lk/t5jNTaeNRfgK6IZZT6xFjDH3DFdGXr1o0aKsv3+ya5+IMDw8zKZNm6YdIxfbAw8+6ogjLxPhkHm+OUBVf++8OyNz7kftbKoxvwc89xmsesxJjAztJKtUkSk8xGc3rs+9b20vWlMyP9Ip0R0IBAL3aYLgnoJ7u8924N6Bc55qtcYHPnD6uEj3bGlYqZk8l/gNgixHeNLMaynAA40x3xTVH4F8waPfR/0gwt0T0hG6gPa97WbAGMM9Gze+efvOHXdOdbMhIhhj2LVr17Q3JHWx/ZCjjzjyMoSD51lsV4cGBz9cLBU/IsbMOqrdzP2f+wxWPfrhJMOVPF+17dzrieT7Xyosppps2adFd249eZ+M3AUCgf2MILjHk6UuyV0XBO5Nj2BUCV0j74Xkke4a55zzBkC4+OLLgDkVUlaB5wFfosUmNSLyOOBxRuTviPkKyO/q40znyNAxxJgfVNPkG865KffZOcfw8HBjnpPer4vth+WRbTlwvvLM64WRP0bk34ZGhn8bF2KiWeYqA2i9Lfvqf3oshz3yIaSVKvMTGFBUhUK8CE3B+2ltzvYKdctGinHfqMlhIBAI7MsEwd2Eqh4qyNsiG88yA3LfRgTpLrPm4AP41myDYHN8Qh3YA4yll7weUC6++PJGj4B22aXqn4PqJ20Un9ZiYxxE5AiQs4Eae+K3RbWy9u673wXQ19c36W1rLUNDQ4yMTB1Irovthx91xJHfmU+xjerWNMveb4w5X8C1bVXoPd57jn7mP7LsxAeQVKpEdj4Pc54LXogW1gspHVlmSE2NyNq91EFdEAxRXELEENsSXvPCQRmt3N0/xHdo0BMI3LcIgrsJEVkR2cK5e3se80FvD7/s7+Fbs1pJIPO6ly6sgdnQiHS///1jke5cdLcn7kTEVSuV1w3Xdm5YvHDR+2YpDubee343iAiZc+dv37b1T2maTrq5EBEqtWT035sZdfYYWHDCUUcccZmILJ0P8VNP1bncq39HLUn+Vi63ZbOb4xW8Z/WzH8/SB68mq9SIS/P+AIEx8WrIo951ZwwP1pQmf79EZmzgNBe8d1hbBDFIlKdBaVPHWxVQX/eEl73R2rt1RIRCXGCC/28gELgXEwT3JO6dP36qDLlZumvqvpm2GZgG7z3Vah7pFoGLLrqs7UJKyM+Edes3vH9Bf/+d1trzVFnQ2RmP29SsJqmqW4zTc4894qhJ7xljGKlW+Mutt9AcnVdVSqUShx56KAZzdF9vz7fnUWyv37Fzx3uKpdJFxTiemye4z63QBk46jq6jl+OqSecmOifGGtF4n3etdD7FmCi/2WhjxKk+C0UxYupCXqZdDoRqOoSVCGMsUVSsL93asW9uC+/VYWTs8V7zE6PZto/36jFixn0HSqUycZR7cHvdl28NAoFApwiSKjAlGq4A+yWNSPf73nc6L3vZM4G5BRyNMeD1kjRNH4PIdXNsJjMRr+pPJ/dOnRXq9XJvzCZnI5pf3kZkxrJm3TrcFEULxhj6+voWLxwYuNQYM08FkvK1Ldu2PaJaq13k/RzH17xZTddDjqJ05CH7kNiejCAk6QgjtcG6nSoYY+u6XPAoNiphojhv52Hqorwuzm0U1XPdHVo/bgp459v+EudZJnnEm3onTVVIshqNz6bxnU7SKpXaLrwqzqWj8x5t8OQyKtVdZFmSd3NsCG+Fsc95bFsKUB8ry2rUkjy1qdwktoG6GDdjc5zuFQgE9mtChDswNeH3fb+lEek+55zTAeacXgKAyJ9GqpXHqfPv7+nufmsnhKr3/juqeoG1/MvspiLUstolmcvG7VPeWtqwcdMmdg3uyv822Y+7YOArXv3xnRTb9aLInR7ebkQ+n2XZ3I43gFd85ig99GgKqw5Ck6wzk51HBCF1Cb7mKJcHMDZi/FND2e1vi9ZvMuaz313eWEPJH4BkJNlwXixvGpObepKZT8iqKVFUyJNBVCkV+2ZuBpN/N6gkg5TiLkql3vbytxvfp5DjFwjslwTBHZhMENv7PY1CynPOeT3QEN3tp5eICFmWjWRp+rbunp6fo/pJYNmc5oieb60FZGQ2qVyq+rtiXPhlMR7flVEEMucplkosP/TQSesZEQb6+v/DiHlSpyPb3vlfZd6dpvAnGzfSB9rfRh7hVQ4/5dEUjlqG1tKOzXW+aUR+VT0i+37VtfOuqaX9zOdHIz88cwmoYk3c8nY6ljgShHcgsF8SBHdgEiGdZN+i3UBpLroTzjnndESEiy767hzn0egmqd9NXfZHg5wfRdFT2xGvApuscuOaO9awdPGSwf6+PlpxQxGEzGc/SZ2bHO4VQZxjUbk86aCpgCkUTynEhTd3OrKdZdl/bt+67T0LFi2suE6M7fI27N0PW03xiENwtX03jeTew+xOMmkhUj/v1NtQmynsJWWsljQQCOwjBMEdGEeLYtsC7wUOA4K79/wggHNO3wU6fYvE3eCcR1V5xztewU9/egNr1tw951QHQfDer3GqT1d4XWSjswRdPMvr+40WNi/o76cQF7a2KoLzAjr5azyFX6WqYgAbx5O0hogcTBR/SrVzt5NGZNf2nTtPLZZLl3rtUP5D5pCuIl3HHkG88sAgtgO7QTBTnc+NByxzrSEIBAIdIwjuwHjGjAd2s5S8AJhsERHoKEmS/Ydz7QtugEolpa+vm5e+9JmcffYFnZoagHfen+9dclUU2Q+KmOe0quWTLP2V857FC5egqjfrLARrLctumupxuo0itFRiqkxno3xcYHnLG9ktepdHnl+tVa8rlIodCXZq6rBL+yid9A+Y7hKa7vs524F9mMZvedDcgcA+QRDcgXYZ3tsTuA+QAX7uBgXC8HCVU055NBdf/B3uuGP93Av6mkc35tZtO7Y/t6e757nlUum9wP1milgbY9iyZet1O3bu5IClB1AqFv/S3d3VaiHZ9rvvvntNUkvGF0yqcsCBB7Bw4cJJ7iRG5NGCPLe9vZuMon/3WXaKieObO3UcNc0wC7opP+JYKMVBbAc6g5EQ6Q4E9hGC4A4E7gN47+nr6+HlL38WZ53V0Sg3QKMJyTcR/rdaqb42juO3WmsParzXjHNu14KBgd8PDPRjjMEYs0ZVW20Fv2XVYYcPTSVzM/WTxLaCEeXsjlWsqd7hXfYMVG/uyIAKPkkprV5B4ehlSDEebd8+SwxwOHBQPiobgDuYMeVr9HNZBqyoj7ER+DuteYSsAA4FEuB2YHMb854tDwJ6yOcnQAr8nry76VT0AEcA/cAIcBuwrYXtlIGjgQFgE/kxaSW/50BgJVAAtuTr6bj1Gjdpe6zTpJAL7yC6A4G9ShDcgcB9hOHhCk972qP50pcu4/bb557LPRUiZmjXrl3ndvV0f71cKp+G6suttaN+1/Un3Ddlzq1XoLtYRETWKtwjuVDZ/SamqDQQY4hk8s+Zd/4ZAo+Z007VMcbswmXPwZi/Qt46fs4NbdKMxSccS+kBq/JiybbEtr4ujgqvFORIoBdADIPAGoEvqPIpGJ9po6pYEz0DkdcZkYdB3tRIjB0SMTcr+ingi01rQL2vI/BQG0XvAz0RtB/w1pitwPdA3qOqG6TecbJ+dI4R+CyNdpXTY1V5K8qvgXrXyrw4UVUxxjxWRH7A+E6mWxAeALLO+RTnMmzeaOggETlDRJ5NfhNSABzCVpDvC/J+8huS0f1rWGeK8NY4Kr5WkBVAQUQqiPzdqfwncPE0fZoeLSJvBR4BLASkvt4dlvhi72vnouqdT6nWhlBVCnH5EiN2FehMdTCRwveBD86wzO5pLVUwEAjMI0FwBwL3ERpR7pe8pOO53OOou5msS7P0PVs2b/nkwgULXtLV1fUyVf2HunnCDeWurrrwUlR1SITfgKxsZfiJFiRGDBs3b2L7jh3joofGGFYeuuJNNormHE00xug9mza+fuf27b9tajmIV6W/f2D2A3qPlCylYw6n9/6rcEnaTq5tAZEvCfqCKdRUL3C8iHxCRJ4APA+oQH684qh4trXRWVMclx4RebDAF9Tqw7OM1wLeSIRiiKPoScWodCnQ17RNAywBXlEqdj+Imj4lc8k9WZYQRwVUWQmc3MoOGWtMrmeFNK2O2u9FttAVR+X/YrzYhtFJKElSQfEIPKgQl/5H86LuZiywVIRXFOPiE5zXZ6jyBxHBSAyGqBh3fc6KfZmO/zDKoMdZG11UKvQcXEtGPjj2viIirxUj59fHn7Aeq62NPgw8XCR6oUCt7jNeFORxoAfv7pgI+rNWjt3u0JDPHQjsVUKnyUDgPsTISIVTTnk0K1ceskceaadZurGWJB8FebBHHwH6EUEvM+oR9c1d+a5oeVAd//LeUygUWLxoEYsWLsxfixayeOHCo6wxD+/Eforw1eGRka9s27mT7fXXtu3bSZJk1q2+81AqlE44hu77H46rpXVP5dm8QOCjwAum2MK4MLnAKdbaf883rRTi8j8XCl0TxfYko28ROdVYeYERJY66KRb6lpdLvZcg9DXvTfM6xkQPKBd7P9bwtPYO1I9bfiaGjZF1xgoikLoKzlXxPsNa+//EyLEz7Wtsu+gqLiwVCuWLphDb46PIIsutNZ+xVuLYxsRRH13F/rdEUXGi2B63XrHQdU4cl07ONbNiTHSiET7FeLE9bp3604RnxTZ+k/cOYyIKhXJ3609H5HZVw1xfYKAFr/FAIDA/hAh3IHAfwrnmXO7z64/R5297Y97dVIFfKfwK75F6ukE2dvH/iTEyDHTvbkiVySklpVJ5nOhVoBBFTzPGlDoguLcliXvvsgOXcfDS8QFJEQEHptUouuYFkuWHHEPhoMVo6pApfJRnHkKxJrq/tdFpzW4tqnqHwitRGRLRc0XkUY3lo6j4umLRn2fFbohs/O4JrjBf914/BBxnjHyGeloKgDXmX1Xkaz7zGCNvUdWlTevdpV5foHCMMXIhEIEixjyvqzTwceCGvNkSAxN2YTPKMGPKTwBR9C7v3DZBcD6tJ+BHRFHxQXFcestMTjb599hgjDxPRI5veuselFOd9+sQ/4nIxo9q+pxOQOX+qnqDGD1AjHnHuPsH1QtU+QIi54jwVACvXgpx+d3WxNc4nxJHxXfU77gan8EvVOUtIiwW4Yvk6SyNAf9F8R9HfCrie0HKTfMcArago2k3eRKICElSuc151xknHCCOC0Q23iM33IFAYIwguAOB+xjDwxVOOeVkLr74u6xZczd7K+KVesVpPbVYuUui6JfWmCfuZrUF5I/qd+b/mbfNzrKMZrGkYCWKnt2Jear6Lyh+jYkEM8VDQVVlYMEA3nuMzPzQ0CUJBz3yYfSvXo14hdYbFY7DWDmV8WsryhnAjwHU6yvEyh+Brvr73cWo60nO+28g0ui3LkDNeX0DsBXlz6r6AhF5etO4q0Cw1paM4ZkT9vurKNcqeq0qLxaRx9XfikR4TubSG6LIgMiC8evxL6pcTSM9RLWGmKJ3mR1JdowIQiHqolzoA8EaYz6h6rvq614rwgOZUGArgDUGhEPJHZS6AbzXC9Tr9xUF1Xer0WvGH0iWi5gbIngCsKjpnWFV/agqdyr6PivmidSvl0bk5Aw9rBCX1orYBaqa5e8JqJ4G/KWuZb8mwtsaH44YM1Aqdfeisk3Rfmm6uVTlqy5zrzXWxoBFRws0u1NXG85c0pG6X1XFWoNEhSC4A4E9TBDcgcB9DO89vb098+HL3RKN+i2P4rVeSKmKV70gEnniboTAgFddonBP/p+KGKEQ2bqAkPrfzEHGmBntCVukpt5/xcC0rbQbMsiYXGz7ulPKxGY4mjniJQtY/NDj66Wfvt3HC5HACRP+tlORn1JvqY7IXSh/qwtQBTYpvkfREVUeqV5XiDEPUtVl6txWkDzbANM/Ydysnvq7islpGjdgQPKbkD8Bj4N6a3c42TkncYwKLG5aJwUGxPBO0IfnB4bfgf+yCGsEgzUxxhTwqlhj3yAijxQEr+4G7/051kaXTzoiAvXD/WHQL6vqkcaYR4BekTeFFESiifsGkNRvPSYezzWIbEAEUdYA28nz1AEpqfqTMpd9NYrMU1GWAw/0Pj1cxKzJ29qDtdI/4WZW1WtWTwtagJhCPnUh80mios8XY54KshTVW0C+m6XVn6Bab24zd8EtAklaRcQQ2cLs06ECgUDbBMEdCNwHyaPcuWNJHuXeg6jiRYgLBeLxXto/8Ko3CDxkhrXFIIcCf4Zc3NVqCXesvRPn3KiA6CqXDz585cp+PwcrNAG86h9GarU/zU7sKF3dXYwMDxPZsYi3GMPACcdjCraeStK2gFoMHDnhb3cbww7vlUp1B4qm5WL/06IoHgH1CjWVUU/3XeTH78950V8+Z8E8XkQe2jyo9+5aVcXY6HAmqUfZlQt8B8YMNhesWmOXlEo93YIOAQc0rRaJ8DXAjg4nPBN4ozXRGcaYi5yvkdUSCnHpqELcc5bW89bTLHmbMdEwiJ2y+i8fLgXuBO5U+D/1HjEGRIwRefOENSou83/Oc8bl8PH7xrB6SXIx6iuISRo3R4pSiMsrcytMhgX+BvK3LEsQiYmiCBFWi8hzxo0Jt6r3u2ppBTHSXy72NOw0iWz0WpA3jO2LPBl4o7X2c2S8SVUrnUr98t5Rqe7CmohCoYvIFjozcCAQmJEguAOB+yANx5K9FeUG8HnlWfOfMg8fsyJfn2k9yaO2dZS4EHPkqiMnSuJV3s+tjXveL0R/Wyy0Yg8+aY6UCkVUIc08PssoHrGCwtJFnWhqU2ByrntNQY21RFGBWjKijD4FmBrv66LfGFB9pLHmUvJ0nfo+SJqklc8oUI56uydF+DWPHdvIQi7im1mg6vurtcGhQqFreVPOsDDZzQNgEUa+ENnCXYl3PzLGSCEuf0zRAQDn3UXeu2viuPTIKcR2fkDHmQ4KLksQsWCMFdXPU4/AN03/S4K5S/LeMN0TviwCkItxO8wED25FD8r3vv5f9fC60xpFW1ilqt+Gsdx1Qaglw//lfEop6kWMWTw+sixTJhdZG59aKvUOe+/e0vnUL20ULIcyykBgDxAEdyBwH6XhWHLRRd/lzjvX7bkNi5Cp5k1qJog4Qb5p4/jFwClTrgpkTpenE4rIClE00RN79VynaY1l4+ZNN23ZunWOnuUKCl0nHI+1lqwzXSQnqs48Tq1QKHTlBYfGUM9dRn1uYaiq9VQWUO8wEmHEPA5jvkHdi7sxfpa5txkp/SaKLao66e6lnuZBNakQ2VjiqNicnmBEBGtKCKamqgn5jQLAb9TzCxFOQDipaZNSLHSfIRL/SMS/0Bp7St0xZDNiPlYsdvczPs8acuuNReSNb4YRSV2WG65474giWxb4nIi8eHTeInjvrqkllXdFtojI1AWEgpBlNZymUoy7yJ1XRpcbvWnw3uN8hjEW793xwKXkTXOaP6yzsiy9XIwgkYBqCcaKhBW9B5XLEPoFnkP92lwvkD1NlPPJm/Z0HPUeZSwlKhAIzA9BcAcC91HGHEv+aY9GuUWEpFajkiT13NQxFFzN2tMH+vof5r1fOnHdXBjIyuKEJjdTFJQtn+s8nXcsXbx4cMmiiRpvlniPKZdYcvQqslorzQp3S0YecW2OitZTrfP/FaJy/SZhupSaPLop8GIR+Qx5R8b6QLKtWht6NWK/lQtSgckRbFRyf0NRi6jpmyBat6vqYOaqiJReJKZwgMAhWZb0idgrDLbm8QVBrhSRf2wa9cRCoVASeHbTeN1G5HLyGHYP41kg8MP6MXkRyC8b+ydil4FcLJMi23zVuey1SVoZymsUAdgxcfdysW8Qtd0IhfHHUtcr4F2GIPW0kMLToyj+/AQnl4qqvh3hU3FcRCTCpR6EL1prrhSRA0EOytLa742Jb5dc9F4rwieatlUUYx7GPAnuEN0OBPYMQXAHAvdhGrncF1/8HbZsHdoj23Tes2XrVqq12pSRYxG5M03S05csXvzf3nsz4T2yLDvutjW3W+e9a+Rsr1p5GOVSKU9Tyal2Yq4iRkz7udZ1HMZGiKkXds69Rm2LCLcDxzX97RB1rhsYbOrq+THyCOqwCNsF+TXID8GhqqXIFj4gom8dG0LwPrsG5DQx9iZrY4wRfN798g5rjaM5HUS01wgUCyV0fHQcVbaiMlgu9xXU+cQ73WYsRiT6LUgtr5yVBOS7QJPgpgvVWMf7gneRt62fCgM0vBq7fMP1Bn1CHJc+C9pc6Lnde30v6PnGxvR0L0QwuMwhIneMy6kXusRoITJRIkQ9NKXaAODlTlRxLiWyRbHGnmGs/SCqY8dH+VPqaq+xEl8nVojjMt478N4Ya4163YFBgE1GotsFQ5ZWUfWXFYtdnxi3PZFWvcznTiiiDATmhSC4A4H7MI1c7n/912fw0Y9eMu/bExHSLGPjpk0zuiNs27btm7VabWD5smUXOjfWRyS3NbMrDjvssEME7mr8PY7iek746KJDnQjdKdrj5ypARHCVCtWt2ykcsAR1c04pSYw11xoZJ7gXI/ZEhKuNKKosF5HXAaWGLYzx8nYMP/RqjjPIZ4yRk8bbeOvFCu8TYWdcKB+IqqCaqfotILcr3CJNqTqCHA/+O4oiYh42boaqPxdBBXmdWPNe8mh8l4h+K8uqzzOFMmlSJY5Kh0246dpJnh4yXuDuFsH7TNO0EhULPe8U0feCjoavVfVWr/oWY8w1wFLyVBRL7j4yougvQd40NhorFBaB36DIakEGmjZWVfTXqh4ROdRa819gn9kkVFXhCkXfaW3h7jyK3fBRkc1gjhSRn4mVMlAC3ZW46rHFuLxJUZy6ZZPdQ2T77I7HHBBB6sWcgUCgcwTBHQjcx2lEua+88lpqIzVKpdkXCc4WY8yoq8hUqCpr1939OVBZdvCyTylqGwLEWtu7cfOm1Tt37ryrIUwW9A9w0IEH4vyoFV+lQ1NdPWf/Y8mb3VTXrYclXWiazvE5vmJ8fFG50PMqZfQJgDGGTyi8HWRI4EzGe1VXEL0U4UAr5irgoAk3PCrCY63YJwMRjQJHkbuN2EeBH8L7SzHmrNHdEl6jKteRi/AHN+2weuW/czs7/ihmLPptjDw7svH7gB9Ya+9njLxq/J7xazwJ8J/Atxn/PCADjs8tBUcZVM97QLei+ts4Lr1PhHdNPMAistSInC95tLzxpgXOMEa+6L2/GrgbWFZ/rw/4EMjngbNp7sqs8nPv9WZjpKcgpatBxuVr5weOB4rIVYzlrQMMipFHZy65y2hhRETq7i2yuFTovgj0w4W4HCv+wxM+m1qtuuv63GZyDyWACJQK3XnRaRDegUBHCII7ELiP04hyv+hFT+Nzn/ku8y+3d09DSG/cvPnCAw848E6F8yJrj1FVvPcs7O8/bqC396rG8lEUkznfHJW7Z2J+eFvzUI5j7hFpBEhuvQu7cjFSLqKZn5N2Ms5fl9r4vDgqvLVJnB0j8P3RDTah3n9SlbViZTWTCw8hF5Qrpvh7VevtIhUuMPAKGcuPP0hErmxeOC9qTS5Js/Q31sSIiX+C8jURXlRfwhobnQmcOYUdXabOfQQVEHMNcM3EBcRwO4wT3BVEL1HPDhGLGHPkNAKxX2AqH+4SeTfUnV71HJPns+fbEnkp8NIJy2uSVs5GhNiWiqq6jMkIcMgUfy8LatO0UgH/7mKh62uj6T/CU0Gemq88vnjRe73AmOIdezrXWlUQCWI7EOgUoSw5EAhQqdR41MkPZNWqQ0iSjrhodARrDM67q7Zs3Xpy6rIvAJmIoCInrNu4kfUbN7Ju40bWrl+H01HPZcSY38zNWWSU41U4RKxhTq/IQprhbt2AtTZveT+Hf7w6kqTy/5xzn59p8rkjR3bJUGX72ZkmSH5QZmO87I1lWETB+83q/YuArdMtrMjP0yx5cy0ZJHO1RjHraTRuBKafZyVJK6cNV7b/bCSZVJ+ZL2MBGWs7X6cXoUcsdV9zndU1TWEj1J06nLtQVT850/Le6+nVZPhXqqNpTsVZbK4qIoNxXKRaG/56rTb8dpAZTzaFryi8R8TWHWXsHnsFAoHOEiLcgUAAVaW7q8iTn3ISn/3Ud6C4j11wRTZv27btVSJy4dJFS95sjT1yYf9ASRrFkaps27qlOY32LwsXLvprIY5Xz6WTnhgzUE2Tp23bsuXCNrtCjqGKXruVxV2WhUevnJsft4CI1LKsdmoUlf5XjLxW4KFAb/4uI9776xD5gvP+vxXFSIR3Oigi36V1oXgXGHKv6gzgF977xxkx70F4PHnqhQfWOJd9FeRcETOcW+iNHq9dqjzbe/caY+SFIubB5DndHtisqj/y6Medz36nKDJlUxttfLabQf636Z2dqlppHBPg1yAt538rug5Gn6iowhvV+78aY14D/AN52klVlesyl3zUSHSltZZCVEK9JgrfYbJzynRsUq+JMQWMqVDLKh+LovJvReR0EU4GFtb3oqaq12cuudia+OKxlKYQbQ4E9meC4A4EAgBUqwkPP/F+XH3lr1m7dsaeKXsHEZIkuV5VX2RtdPiiRQsN5JaAznvuvHstzvuGP16lz7kvF+L4g3PbpIDX52dJMnfBDeCVndfeyILDDkEiizq/+3V2z7dV9dsKB+JlsVcnIrpV1a0XiXJxjqAeHH6tNfZZ7W1mdP//qMhzXVY7EOxSa0wNkXVe/dDEdIgmUu/d+WAuUM2WC/ECT1azxmxSNdvETGntWEdRPxpR/iMSPbXpHbzXuumJB+QjiP1Iq3vUFKlm7POVT6vqF7IsWWFNsUuMblXlbvW+3h9T6vWkDALPa3lb5OlQeWq8RdWh8FNUfwos9o4DRMQaK1udT9c5l2LNlP1wAoHAfkgQ3IFAAADvlXJXiSc95QQ+8+lv7+3pTMlo+3D09ua27SLCihXjU5C9859T1ddCc2fK2eG9p1wuP2rFypUnKfyq3XHGjZk6KjfcQvlhx+Qir3M2bPfUX/Vc9vnN+lX0HtlNN8upVlP0LoG75vLkYQ+QqOqte3B7W+qvJoJDdiBwbyII7kAgMEqtlnDCiffjqqt+zS1/u31vT6clrDFs2rqV9Rs2jHM9UdUtByxdesZBSw/8hvNuhhFmRlVjdfouhz69IxLIQLp2C3bpRkpHHoJP0t2vEwgEAoH9miC4A4HAKN57urpKPOnJJ3DTX/ZkgK99RIQ0TRkZGZn0Xq2WXAocC7x3TtuAp4rXk536azpSjGmFyh/+jsSWwoqlaNr+DUEgEAgE9n2C4A4EAuOoVGo8/MTjOPzwg7lz3d17ezot0RDBEyLcjWK4s1C1Ysy755DGYIzIh1LnH5OmaUdC0uo8tetuZNGiXqLuMpoF0R0IBAL3VoLgDgQC41BVurvLPOlpj+CHP+lI2vI+gL6nlia3F6L4P4Al7YxgjDkJ1bcNDg7+R4csB/GDjuTK6zj4KSdhSwXUd6SIMhAIBAL7GEFwBwKBSVQqNR71qAdy9FErqdUSCuXZ2A3vgwgkSfJFK3KNGHuOEXkOueVby6gq5WLpzIH+/h9UqtU/WdsZ60S3fZhtP/09Bzz1RBwKfp8uJgwEAoFAGwTBHQgEJuG9p6e3i1e+8p+55Is/YB93lGiJenrJ31X9C7xyojXmjYI8TUR6gZb2UVW7ysXSp4px/Pjb7ryjWq1UOzI3vWc9w2XDqieeRFZNOulcEggEAoF9gD0luIO/0d6n059Bd4fHC0wmYi92gx0ZrnLK00/mzjUb+MlPf7+3pjEvqOq1XvVaI7JqaGjo6eVS6VnGmPuLSD+MtZafChF5RBzF51ZGKqdXq50R3AC3/+g6nHMc8cRH4NMsiO5AIBC4F7GnBHe4cux9tKWPQaEFba6KXggsJ+8WF+g8ArgsY7vze++OtVbznPDw4/npz35/b011uG1kZPi8arV6Xk9Pz8piofgw9f5k5939C4X4cFUOnmolr/r6w1as/Fs1Tc7vmDBWxd+6gaEDb6P72MNQF4ooA4FA4N7CnhLczwDKBHG2t7CgO1VbOfxCCx31HPCxuU8rsDu8z197S3A7p3t1+3sCY0YfItyBcEctSS4drgyzdPGSJc67ZSCHGWGlV79CRA4WZCGwYKC///WZd7/0qh0L/6sq1T+tIR7opbBscXAuCQQCgXsJcm/IzQwEAoFAIBAIBPZV9lp+aCAQCAQCgUAgcF8gCO5AIBAIBAKBQGAeCYI7EAgEAoFAIBCYR4LgDgQCgUAgEAgE5pEguAOBQCAQCAQCgXkkCO5AIBAIBAKBQGAeCYI7EAgEAoFAIBCYR4LgDgQCgUAgEAgE5pEguAOBQCAQCAQCgXkkCO5AIBAIBAKBQGAeCYI7EAgEAoFAIBCYR4LgDgQCgUAgEAgE5pEguAOBQCAQCAQCgXnk/wP3dymon97AZwAAAABJRU5ErkJggg==	d7bb35e95e0b4f74cc6bcf82eb24a68380c56ab0bc567dd516c040b072f53560	\N
\.


--
-- Data for Name: billing_documents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.billing_documents (id, kind, number, company_id, customer_name, customer_address, customer_tin, issue_date, due_date, terms, gst_rate, gst_inclusive, notes, status, created_at, updated_at, client_id) FROM stdin;
2	quotation	QT-000001	3	Bb	\N	\N	2026-05-10	\N	\N	0.00	t	Looking Forward in working with You in the future\n\nAll payments shall be made in favor of Leo E. Services.\n\nBank: Maldives Islamic Bank\nAccount Number: 90101480044441000	draft	2026-05-10 17:24:05.350134+00	2026-05-10 17:24:05.350134+00	\N
3	invoice	INV-000001	3	TEST	\N	\N	2026-06-05	2026-06-05	Custom	8.00	f	Thank you.\nThis invoice is valid without a stamp or signature.\nAll payments shall be made in favor of Leo E. Services.\n\nBank: Maldives Islamic Bank\nAccount Number: 90101480044441000\nCurrency: MVR	draft	2026-06-05 07:38:52.544393+00	2026-06-05 07:38:52.544393+00	\N
\.


--
-- Data for Name: billing_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.billing_items (id, document_id, "position", description, detail, qty, rate, amount) FROM stdin;
2	2	0	Recruitment	\N	1.0000	550.0000	550.00
3	3	0	HGF	\N	30.0000	236.0000	7080.00
\.


--
-- Data for Name: clients; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.clients (id, name, contact_person, phone, email, address, notes, created_at, updated_at, tin) FROM stdin;
3	Ahmet Aydeniz Maldives Pvt Ltd - Ayada Maldives	Ms. Neta	7303082	hrm@ayadamaldives.com	H. Aagadhage, 4th Floor Boduthakurufaanu Magu	\N	2026-06-05 08:13:44.617348+00	2026-06-05 12:42:04.056+00	1009905GST001
\.


--
-- Data for Name: companies; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.companies (id, name, address, email, country, registration_number, created_at, updated_at, letterhead_image, signature_image, phone, signatory_name, signatory_designation) FROM stdin;
1	NOORAY & CO PVT LTD	Karankaage, L. isdhoo	noorayinvestment@outlook.com	Maldives	C02892026	2026-05-10 08:55:05.650166+00	2026-05-10 11:15:51.038+00	\N	\N	+960 9652266	Gasim noorahdheen	Director
3	LEO EMPLOYMENT SERVICES PVT LTD	\N	\N	\N	C20542025	2026-05-10 12:29:37.392383+00	2026-05-10 12:29:37.392383+00	\N	\N	\N	\N	\N
\.


--
-- Data for Name: expense_categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.expense_categories (id, name, color, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: expenses; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.expenses (id, category_id, amount, expense_date, remarks, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: loa_entries; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.loa_entries (id, company_id, passport_id, company_name, company_address, company_email, company_country, company_registration_number, candidate_name, candidate_address, candidate_nationality, candidate_date_of_birth, candidate_passport_number, candidate_emergency_contact, job_title, work_type, basic_salary, salary_payment_date, work_site, date_of_commence, job_description, working_hours, work_status, contract_duration, signatory_name, signatory_designation, signature_date, created_at, updated_at, company_phone) FROM stdin;
3	1	12	NOORAY & CO PVT LTD	Karankaage, L. isdhoo	noorayinvestment@outlook.com	Maldives	C02892026	Antor Biswas Antu	Aishar, Dashar, Dorshona Bazar - 7900, Madaripur	bangladeshi	15 Sep 2003	A19001663	Mom (9947262)	HR Attendant	General	350	End of each month	Ithaa corner	Date of Arrival	Job Description will be given the time of signing the contract	09:00 to 17:00 Saturday to Sunday	Contract based	Contract will be for 2 years, Probation period is 3 months	Gasim noorahdheen	Director	06/06/2026	2026-06-06 12:40:03.981009+00	2026-06-06 12:40:03.981009+00	+960 9652266
\.


--
-- Data for Name: loa_options; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.loa_options (id, category, value, created_at, company_id) FROM stdin;
5	job_title	HR Attendant	2026-06-06 12:38:19.021266+00	1
6	work_type	General	2026-06-06 12:38:26.85501+00	1
7	work_site	Ithaa corner	2026-06-06 12:38:33.471089+00	1
\.


--
-- Data for Name: passports; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.passports (id, full_name, passport_number, date_of_birth, date_of_issue, date_of_expiry, address, nationality, status, error_message, original_filename, created_at, updated_at, client_id, work_permit_number, agent, company_id, submitted) FROM stdin;
4	MD MAHAMUDUL HASAN SHUVO	A14210334	27 JAN 2006	27 FEB 2024	26 FEB 2034	WEST MAJIPARA, WARD-09, DASHAR, BIRMOHON - 7900, MADARIPUR	bangladesh	completed	\N	IMG_5326.jpeg	2026-06-05 12:45:46.685739+00	2026-06-05 12:46:22.15+00	3	WP00712313	\N	\N	f
6	ANTU ANTOR BISWAS K CLLLLLLLLLLLLKLK	A19001663	15 SEP 2003	\N	10 JUN 2035	~~ AISHAR, DASHAR, DORSHONA BAZAR - 7900, MADARIPUR me A =- Thee —_— Af	bangladesh	completed	\N	IMG_5328.jpeg	2026-06-06 11:06:30.831723+00	2026-06-06 11:06:32.419+00	\N	\N	\N	\N	f
7	ANTU ANTOR BISWAS K CLLLLLLLLLLLLKLK	A19001663	15 SEP 2003	\N	10 JUN 2035	~~ AISHAR, DASHAR, DORSHONA BAZAR - 7900, MADARIPUR me A =- Thee —_— Af	bangladesh	completed	\N	IMG_5328.jpeg	2026-06-06 11:07:39.925773+00	2026-06-06 11:07:41.116+00	\N	\N	\N	\N	f
8	ANTU K KANTORSBISWASK L LL	A19001663	15 SEP 2003	\N	10 JUN 2035	AISHAR, DASHAR, DORSHONA BAZAR - 7900, MADARIPUR mae HIN Ms c fm Emergency Contact CL H	bangladesh	completed	\N	IMG_5328.jpeg	2026-06-06 11:50:31.145999+00	2026-06-06 11:50:36.851+00	\N	\N	\N	\N	f
9	Antor Biswas Antu	A19001663	15 Sep 2003	11 Jun 2025	10 Jun 2035	Aishar, Dashar, Dorshona Bazar - 7900, Madaripur	bangladeshi	completed	\N	IMG_5328.jpeg	2026-06-06 12:23:23.646841+00	2026-06-06 12:23:31.099+00	\N	\N	\N	\N	f
10	Antor Biswas Antu	A19001663	15 Sep 2003	11 Jun 2025	10 Jun 2035	Aishar, Dashar, Dorshona Bazar - 7900, Madaripur	bangladeshi	completed	\N	IMG_5328.jpeg	2026-06-06 12:36:12.801126+00	2026-06-06 12:36:19.631+00	\N	\N	\N	\N	f
11	Antor Biswas Antu	A19001663	15 Sep 2003	11 Jun 2025	10 Jun 2035	Aishar, Dashar, Dorshona Bazar - 7900, Madaripur	bangladeshi	completed	\N	IMG_5328.jpeg	2026-06-06 12:38:51.038953+00	2026-06-06 12:38:58.219+00	\N	\N	\N	\N	f
12	Antor Biswas Antu	A19001663	15 Sep 2003	11 Jun 2025	10 Jun 2035	Aishar, Dashar, Dorshona Bazar - 7900, Madaripur	bangladesh	completed	\N	IMG_5328.jpeg	2026-06-06 12:39:35.785158+00	2026-06-06 12:48:11.315+00	3	\N	\N	1	t
\.


--
-- Data for Name: passwords; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.passwords (id, website, owner, username, password, created_at, updated_at) FROM stdin;
5	Gmail	Leo employment services	leo.emp.services@gmail.com	Skycopr	2026-05-11 15:10:05.189919+00	2026-05-11 15:10:05.189919+00
\.


--
-- Data for Name: push_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.push_tokens (token, platform, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: session; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.session (sid, sess, expire) FROM stdin;
njUlg5Cwlr7NBTeVYBzsfyAMTz_Tl__s	{"cookie":{"originalMaxAge":604800000,"expires":"2026-06-12T06:54:59.577Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"authenticated":true}	2026-06-12 08:16:20
gcu6_6YWVUeRnkjTdgzoIhy7hx6Swmmi	{"cookie":{"originalMaxAge":604800000,"expires":"2026-06-12T12:41:40.275Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"authenticated":true}	2026-06-12 13:12:16
29Jeoh7SZkYRozvk1dblg4xBCaEK0x5L	{"cookie":{"originalMaxAge":604800000,"expires":"2026-06-10T15:11:30.997Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"authenticated":true}	2026-06-13 12:49:45
\.


--
-- Data for Name: tasks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tasks (id, title, notes, status, priority, due_date, parent_id, "position", completed_at, created_at, updated_at) FROM stdin;
\.


--
-- Name: billing_documents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.billing_documents_id_seq', 3, true);


--
-- Name: billing_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.billing_items_id_seq', 3, true);


--
-- Name: clients_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.clients_id_seq', 3, true);


--
-- Name: companies_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.companies_id_seq', 3, true);


--
-- Name: expense_categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.expense_categories_id_seq', 6, true);


--
-- Name: expenses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.expenses_id_seq', 3, true);


--
-- Name: loa_entries_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.loa_entries_id_seq', 3, true);


--
-- Name: loa_options_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.loa_options_id_seq', 7, true);


--
-- Name: passports_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.passports_id_seq', 12, true);


--
-- Name: passwords_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.passwords_id_seq', 5, true);


--
-- Name: tasks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.tasks_id_seq', 1, true);


--
-- Name: app_settings app_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (id);


--
-- Name: billing_documents billing_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_documents
    ADD CONSTRAINT billing_documents_pkey PRIMARY KEY (id);


--
-- Name: billing_items billing_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_items
    ADD CONSTRAINT billing_items_pkey PRIMARY KEY (id);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: expense_categories expense_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_categories
    ADD CONSTRAINT expense_categories_pkey PRIMARY KEY (id);


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: loa_entries loa_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loa_entries
    ADD CONSTRAINT loa_entries_pkey PRIMARY KEY (id);


--
-- Name: loa_options loa_options_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loa_options
    ADD CONSTRAINT loa_options_pkey PRIMARY KEY (id);


--
-- Name: passports passports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.passports
    ADD CONSTRAINT passports_pkey PRIMARY KEY (id);


--
-- Name: passwords passwords_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.passwords
    ADD CONSTRAINT passwords_pkey PRIMARY KEY (id);


--
-- Name: push_tokens push_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_pkey PRIMARY KEY (token);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (sid);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_session_expire" ON public.session USING btree (expire);


--
-- Name: billing_documents_kind_number_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX billing_documents_kind_number_unique ON public.billing_documents USING btree (kind, number);


--
-- Name: expense_categories_name_unique_ci; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX expense_categories_name_unique_ci ON public.expense_categories USING btree (lower(name));


--
-- Name: loa_options_company_category_value_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX loa_options_company_category_value_idx ON public.loa_options USING btree (company_id, category, lower(value));


--
-- Name: billing_documents billing_documents_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_documents
    ADD CONSTRAINT billing_documents_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: billing_documents billing_documents_company_id_companies_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_documents
    ADD CONSTRAINT billing_documents_company_id_companies_id_fk FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;


--
-- Name: billing_items billing_items_document_id_billing_documents_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_items
    ADD CONSTRAINT billing_items_document_id_billing_documents_id_fk FOREIGN KEY (document_id) REFERENCES public.billing_documents(id) ON DELETE CASCADE;


--
-- Name: expenses expenses_category_id_expense_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_category_id_expense_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.expense_categories(id) ON DELETE RESTRICT;


--
-- Name: loa_options loa_options_company_id_companies_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loa_options
    ADD CONSTRAINT loa_options_company_id_companies_id_fk FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: passports passports_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.passports
    ADD CONSTRAINT passports_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: passports passports_company_id_companies_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.passports
    ADD CONSTRAINT passports_company_id_companies_id_fk FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- Name: tasks tasks_parent_id_tasks_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_parent_id_tasks_id_fk FOREIGN KEY (parent_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict UICTje6xlWPue3ZGeqJ5Cmmpt3FHSP1OAnfVLl6tLBWt7ora5Qkh85nhSap6ra4

