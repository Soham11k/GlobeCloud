from globe.db.url import normalize_database_url


def test_supabase_postgres_uri_gets_psycopg_and_ssl():
    url = normalize_database_url(
        "postgresql://postgres.abc:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
    )
    assert url.startswith("postgresql+psycopg://")
    assert "sslmode=require" in url


def test_postgres_scheme_alias():
    url = normalize_database_url("postgres://user:pass@localhost:5432/mydb")
    assert url == "postgresql+psycopg://user:pass@localhost:5432/mydb"


def test_local_url_unchanged_except_driver():
    url = normalize_database_url("postgresql://globe:globe@localhost:5432/globe_platform")
    assert url == "postgresql+psycopg://globe:globe@localhost:5432/globe_platform"


def test_preserves_existing_sslmode():
    url = normalize_database_url(
        "postgresql://postgres.abc:secret@db.abc.supabase.co:5432/postgres?sslmode=verify-full"
    )
    assert "sslmode=verify-full" in url
