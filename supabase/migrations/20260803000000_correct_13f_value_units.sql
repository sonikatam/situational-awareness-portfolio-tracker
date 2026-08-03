-- SEC Form 13F values have been reported in dollars, rather than thousands
-- of dollars, since January 3, 2023. Every filing currently tracked by this
-- project is newer than that cutoff, so repair values imported by the old
-- parser's 1,000x multiplier.
update positions p
set value_usd = p.value_usd / 1000
from filings f
where p.filing_id = f.id
  and f.form_type in ('13F-HR', '13F-HR/A')
  and f.report_period >= date '2023-01-01';
