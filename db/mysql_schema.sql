-- MySQL 8.0 schema for importing the sample financial data.
CREATE DATABASE IF NOT EXISTS finscope
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE finscope;

CREATE TABLE IF NOT EXISTS companies (
  company_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_name VARCHAR(120) NOT NULL,
  industry VARCHAR(80) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'CNY',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS financial_periods (
  period_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_id BIGINT UNSIGNED NOT NULL,
  fiscal_year SMALLINT UNSIGNED NOT NULL,
  revenue DECIMAL(18, 2) NOT NULL,
  cogs DECIMAL(18, 2) NOT NULL,
  operating_expenses DECIMAL(18, 2) NOT NULL,
  net_income DECIMAL(18, 2) NOT NULL,
  current_assets DECIMAL(18, 2) NOT NULL,
  current_liabilities DECIMAL(18, 2) NOT NULL,
  total_liabilities DECIMAL(18, 2) NOT NULL,
  total_assets DECIMAL(18, 2) NOT NULL,
  equity DECIMAL(18, 2) NOT NULL,
  operating_cash_flow DECIMAL(18, 2) NOT NULL,
  accounts_receivable DECIMAL(18, 2) NOT NULL,
  inventory DECIMAL(18, 2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_company_year UNIQUE (company_id, fiscal_year),
  CONSTRAINT fk_period_company
    FOREIGN KEY (company_id) REFERENCES companies(company_id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE OR REPLACE VIEW company_financial_summary AS
SELECT
  c.company_name,
  p.fiscal_year,
  p.revenue,
  ROUND((p.revenue - p.cogs) / p.revenue, 6) AS gross_margin,
  ROUND(p.net_income / p.revenue, 6) AS net_margin,
  ROUND(p.total_liabilities / p.total_assets, 6) AS debt_ratio,
  ROUND(p.current_assets / p.current_liabilities, 6) AS current_ratio,
  ROUND(p.net_income / p.equity, 6) AS roe,
  ROUND(p.operating_cash_flow / p.net_income, 6) AS cash_conversion
FROM financial_periods p
JOIN companies c ON c.company_id = p.company_id;
