USE finscope;

INSERT INTO companies (company_name, industry, currency)
VALUES ('澄明制造股份有限公司', '高端装备制造', 'CNY')
ON DUPLICATE KEY UPDATE company_name = VALUES(company_name);

SET @company_id = (
  SELECT company_id
  FROM companies
  WHERE company_name = '澄明制造股份有限公司'
  LIMIT 1
);

INSERT INTO financial_periods (
  company_id, fiscal_year, revenue, cogs, operating_expenses, net_income,
  current_assets, current_liabilities, total_liabilities, total_assets,
  equity, operating_cash_flow, accounts_receivable, inventory
) VALUES
  (@company_id, 2021, 4420, 3170, 665, 476, 1810, 1180, 2300, 4600, 2300, 520, 680, 530),
  (@company_id, 2022, 4860, 3440, 720, 546, 1980, 1240, 2460, 4920, 2460, 610, 720, 560),
  (@company_id, 2023, 5320, 3735, 790, 628, 2130, 1280, 2530, 5280, 2750, 590, 760, 600),
  (@company_id, 2024, 5610, 3985, 880, 564, 2240, 1430, 2760, 5520, 2760, 455, 890, 680)
ON DUPLICATE KEY UPDATE
  revenue = VALUES(revenue),
  cogs = VALUES(cogs),
  operating_expenses = VALUES(operating_expenses),
  net_income = VALUES(net_income),
  current_assets = VALUES(current_assets),
  current_liabilities = VALUES(current_liabilities),
  total_liabilities = VALUES(total_liabilities),
  total_assets = VALUES(total_assets),
  equity = VALUES(equity),
  operating_cash_flow = VALUES(operating_cash_flow),
  accounts_receivable = VALUES(accounts_receivable),
  inventory = VALUES(inventory);
