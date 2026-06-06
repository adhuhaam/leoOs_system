-- ============================================================
-- LEO OS — Data Export
-- Generated: 06 Jun 2026
-- Tables: companies, passports, loa_entries
-- ============================================================

-- ── COMPANIES ────────────────────────────────────────────────

INSERT INTO companies (id, name, address, email, phone, country, registration_number, signatory_name, signatory_designation, created_at, updated_at) VALUES
(1, 'NOORAY & CO PVT LTD', 'Karankaage, L. isdhoo', 'noorayinvestment@outlook.com', '+960 9652266', 'Maldives', 'C02892026', 'Gasim noorahdheen', 'Director', '2026-05-10 08:55:05.650166+00', '2026-05-10 11:15:51.038+00'),
(3, 'LEO EMPLOYMENT SERVICES PVT LTD', NULL, NULL, NULL, NULL, 'C20542025', NULL, NULL, '2026-05-10 12:29:37.392383+00', '2026-05-10 12:29:37.392383+00');

-- ── PASSPORTS ────────────────────────────────────────────────

INSERT INTO passports (id, full_name, passport_number, nationality, date_of_birth, date_of_issue, date_of_expiry, address, status, submitted, work_permit_number, agent, client_id, company_id, created_at, updated_at) VALUES
(4,  'MD MAHAMUDUL HASAN SHUVO',              'A14210334', 'bangladesh',  '27 JAN 2006', '27 FEB 2024', '26 FEB 2034', 'WEST MAJIPARA, WARD-09, DASHAR, BIRMOHON - 7900, MADARIPUR', 'completed', false, 'WP00712313', NULL, 3,    NULL, '2026-06-05 12:45:46.685739+00', '2026-06-05 12:46:22.15+00'),
(6,  'ANTU ANTOR BISWAS K CLLLLLLLLLLLLKLK',  'A19001663', 'bangladesh',  '15 SEP 2003', NULL,          '10 JUN 2035', '~~ AISHAR, DASHAR, DORSHONA BAZAR - 7900, MADARIPUR me A =- Thee —_— Af', 'completed', false, NULL, NULL, NULL, NULL, '2026-06-06 11:06:30.831723+00', '2026-06-06 11:06:32.419+00'),
(7,  'ANTU ANTOR BISWAS K CLLLLLLLLLLLLKLK',  'A19001663', 'bangladesh',  '15 SEP 2003', NULL,          '10 JUN 2035', '~~ AISHAR, DASHAR, DORSHONA BAZAR - 7900, MADARIPUR me A =- Thee —_— Af', 'completed', false, NULL, NULL, NULL, NULL, '2026-06-06 11:07:39.925773+00', '2026-06-06 11:07:41.116+00'),
(8,  'ANTU K KANTORSBISWASK L LL',             'A19001663', 'bangladesh',  '15 SEP 2003', NULL,          '10 JUN 2035', 'AISHAR, DASHAR, DORSHONA BAZAR - 7900, MADARIPUR mae HIN Ms c fm Emergency Contact CL H', 'completed', false, NULL, NULL, NULL, NULL, '2026-06-06 11:50:31.145999+00', '2026-06-06 11:50:36.851+00'),
(9,  'Antor Biswas Antu',                      'A19001663', 'bangladeshi', '15 Sep 2003', '11 Jun 2025', '10 Jun 2035', 'Aishar, Dashar, Dorshona Bazar - 7900, Madaripur',           'completed', false, NULL, NULL, NULL, NULL, '2026-06-06 12:23:23.646841+00', '2026-06-06 12:23:31.099+00'),
(10, 'Antor Biswas Antu',                      'A19001663', 'bangladeshi', '15 Sep 2003', '11 Jun 2025', '10 Jun 2035', 'Aishar, Dashar, Dorshona Bazar - 7900, Madaripur',           'completed', false, NULL, NULL, NULL, NULL, '2026-06-06 12:36:12.801126+00', '2026-06-06 12:36:19.631+00'),
(11, 'Antor Biswas Antu',                      'A19001663', 'bangladeshi', '15 Sep 2003', '11 Jun 2025', '10 Jun 2035', 'Aishar, Dashar, Dorshona Bazar - 7900, Madaripur',           'completed', false, NULL, NULL, NULL, NULL, '2026-06-06 12:38:51.038953+00', '2026-06-06 12:38:58.219+00'),
(12, 'Antor Biswas Antu',                      'A19001663', 'bangladesh',  '15 Sep 2003', '11 Jun 2025', '10 Jun 2035', 'Aishar, Dashar, Dorshona Bazar - 7900, Madaripur',           'completed', true,  NULL, NULL, 3,    1,    '2026-06-06 12:39:35.785158+00', '2026-06-06 12:48:11.315+00');

-- ── LOA ENTRIES ──────────────────────────────────────────────

INSERT INTO loa_entries (id, company_id, passport_id, company_name, company_address, company_email, company_phone, company_country, company_registration_number, candidate_name, candidate_address, candidate_nationality, candidate_date_of_birth, candidate_passport_number, candidate_emergency_contact, job_title, work_type, basic_salary, salary_payment_date, work_site, date_of_commence, job_description, working_hours, work_status, contract_duration, signatory_name, signatory_designation, signature_date, created_at, updated_at) VALUES
(3, 1, 12, 'NOORAY & CO PVT LTD', 'Karankaage, L. isdhoo', 'noorayinvestment@outlook.com', '+960 9652266', 'Maldives', 'C02892026', 'Antor Biswas Antu', 'Aishar, Dashar, Dorshona Bazar - 7900, Madaripur', 'bangladeshi', '15 Sep 2003', 'A19001663', 'Mom (9947262)', 'HR Attendant', 'General', '350', 'End of each month', 'Ithaa corner', 'Date of Arrival', 'Job Description will be given the time of signing the contract', '09:00 to 17:00 Saturday to Sunday', 'Contract based', 'Contract will be for 2 years, Probation period is 3 months', 'Gasim noorahdheen', 'Director', '06/06/2026', '2026-06-06 12:40:03.981009+00', '2026-06-06 12:40:03.981009+00');

-- ── Sequence resets (run after importing to avoid ID conflicts) ──

SELECT setval('companies_id_seq', (SELECT MAX(id) FROM companies));
SELECT setval('passports_id_seq', (SELECT MAX(id) FROM passports));
SELECT setval('loa_entries_id_seq', (SELECT MAX(id) FROM loa_entries));
