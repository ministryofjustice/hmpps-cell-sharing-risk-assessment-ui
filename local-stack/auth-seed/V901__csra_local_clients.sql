-- Local-dev only: seed HMPPS Auth with the CSRA OAuth clients.
--
-- This migration is mounted into the dockerised hmpps-auth (dev profile / H2 in-memory)
-- via a `filesystem:` flyway location (see SPRING_FLYWAY_LOCATIONS in docker-compose.yml).
-- It runs after the built-in V900_* dev seed, so the `hmpps-typescript-template*` rows it
-- clones from already exist.
--
-- Three clients are created, mirroring production wiring:
--   * hmpps-cell-sharing-risk-assessment-ui         - authorization_code (user login)
--   * hmpps-cell-sharing-risk-assessment-ui-system  - client_credentials (UI->API calls),
--       granted the CSRA API roles ROLE_CSRA_REVIEW__R / ROLE_CSRA_REVIEW__RW / the rollout
--       admin role ROLE_PRISONER_CSRA__ADMIN, the prison-api splash-screen roles used by the
--       rollout console, and the prisoner-search read role PRISONER_SEARCH__PRISONER__RO.
--   * hmpps-cell-sharing-risk-assessment-api        - client_credentials, the API's *own*
--       registration (SYSTEM_CLIENT_ID/SYSTEM_CLIENT_SECRET) used to call prisoner-search and
--       prison-api. Without it the API cannot get a token and every downstream call 401s.
--
-- Each client is stored in the legacy `oauth_client_details` table and the Spring
-- Authorization Server `oauth2_registered_client` table. We clone the template rows with
-- INSERT ... SELECT so all the fiddly settings/JSON columns are copied verbatim.
--
-- IMPORTANT: for client-credentials tokens, hmpps-auth's TokenCustomizer sources the JWT
-- `authorities` claim from the `oauth2_authorization_consent` table (keyed by the registered
-- client id + client id), NOT from `oauth_client_details.authorities`. So each client-credentials
-- client also needs a consent row carrying its roles.
--
-- Secret for all three clients is the dev default `clientsecret`.

------------------------------------------------------------------------------------------------
-- Legacy oauth_client_details (source of client authorities)
------------------------------------------------------------------------------------------------

-- auth-code client (user login) - clone of hmpps-typescript-template
INSERT INTO oauth_client_details (client_id, access_token_validity, additional_information, authorities,
                                  authorized_grant_types, autoapprove, client_secret, refresh_token_validity,
                                  resource_ids, scope, web_server_redirect_uri)
SELECT 'hmpps-cell-sharing-risk-assessment-ui', access_token_validity, additional_information, authorities,
       authorized_grant_types, autoapprove, client_secret, refresh_token_validity,
       resource_ids, scope, web_server_redirect_uri
FROM oauth_client_details
WHERE client_id = 'hmpps-typescript-template';

-- system client (client-credentials) - clone of hmpps-typescript-template-system, with CSRA roles
INSERT INTO oauth_client_details (client_id, access_token_validity, additional_information, authorities,
                                  authorized_grant_types, autoapprove, client_secret, refresh_token_validity,
                                  resource_ids, scope, web_server_redirect_uri)
SELECT 'hmpps-cell-sharing-risk-assessment-ui-system', access_token_validity, additional_information,
       'ROLE_CSRA_REVIEW__R,ROLE_CSRA_REVIEW__RW,ROLE_PRISONER_CSRA__ADMIN,ROLE_PRISON_API__SPLASH_SCREEN__RO,ROLE_PRISON_API__SPLASH_SCREEN__RW',
       authorized_grant_types, autoapprove, client_secret, refresh_token_validity,
       resource_ids, scope, web_server_redirect_uri
FROM oauth_client_details
WHERE client_id = 'hmpps-typescript-template-system';

-- the API's own system client (client-credentials), used by the API to call prisoner-search and
-- prison-api. Roles mirror helm_deploy/hmpps-cell-sharing-risk-assessment-api/values.yaml.
INSERT INTO oauth_client_details (client_id, access_token_validity, additional_information, authorities,
                                  authorized_grant_types, autoapprove, client_secret, refresh_token_validity,
                                  resource_ids, scope, web_server_redirect_uri)
SELECT 'hmpps-cell-sharing-risk-assessment-api', access_token_validity, additional_information,
       'ROLE_PRISONER_SEARCH,ROLE_ESTABLISHMENT_ROLL',
       authorized_grant_types, autoapprove, client_secret, refresh_token_validity,
       resource_ids, scope, web_server_redirect_uri
FROM oauth_client_details
WHERE client_id = 'hmpps-typescript-template-system';

------------------------------------------------------------------------------------------------
-- Spring Authorization Server oauth2_registered_client
------------------------------------------------------------------------------------------------

-- auth-code client - clone of hmpps-typescript-template
INSERT INTO oauth2_registered_client (id, client_id, client_id_issued_at, client_secret,
                                      client_secret_expires_at, client_name, client_authentication_methods,
                                      authorization_grant_types, redirect_uris, scopes, client_settings,
                                      token_settings, post_logout_redirect_uris, mfa, mfa_remember_me,
                                      resource_ids, skip_to_azure, last_accessed)
SELECT 'c57a0001-0000-4000-a000-000000000001', 'hmpps-cell-sharing-risk-assessment-ui',
       client_id_issued_at, client_secret, client_secret_expires_at,
       'hmpps-cell-sharing-risk-assessment-ui', client_authentication_methods,
       authorization_grant_types, redirect_uris, scopes, client_settings,
       token_settings, post_logout_redirect_uris, mfa, mfa_remember_me,
       resource_ids, skip_to_azure, last_accessed
FROM oauth2_registered_client
WHERE client_id = 'hmpps-typescript-template';

-- system client - clone of hmpps-typescript-template-system
INSERT INTO oauth2_registered_client (id, client_id, client_id_issued_at, client_secret,
                                      client_secret_expires_at, client_name, client_authentication_methods,
                                      authorization_grant_types, redirect_uris, scopes, client_settings,
                                      token_settings, post_logout_redirect_uris, mfa, mfa_remember_me,
                                      resource_ids, skip_to_azure, last_accessed)
SELECT 'c57a0002-0000-4000-a000-000000000002', 'hmpps-cell-sharing-risk-assessment-ui-system',
       client_id_issued_at, client_secret, client_secret_expires_at,
       'hmpps-cell-sharing-risk-assessment-ui-system', client_authentication_methods,
       authorization_grant_types, redirect_uris, scopes, client_settings,
       token_settings, post_logout_redirect_uris, mfa, mfa_remember_me,
       resource_ids, skip_to_azure, last_accessed
FROM oauth2_registered_client
WHERE client_id = 'hmpps-typescript-template-system';

-- the API's own system client - clone of hmpps-typescript-template-system
INSERT INTO oauth2_registered_client (id, client_id, client_id_issued_at, client_secret,
                                      client_secret_expires_at, client_name, client_authentication_methods,
                                      authorization_grant_types, redirect_uris, scopes, client_settings,
                                      token_settings, post_logout_redirect_uris, mfa, mfa_remember_me,
                                      resource_ids, skip_to_azure, last_accessed)
SELECT 'c57a0003-0000-4000-a000-000000000003', 'hmpps-cell-sharing-risk-assessment-api',
       client_id_issued_at, client_secret, client_secret_expires_at,
       'hmpps-cell-sharing-risk-assessment-api', client_authentication_methods,
       authorization_grant_types, redirect_uris, scopes, client_settings,
       token_settings, post_logout_redirect_uris, mfa, mfa_remember_me,
       resource_ids, skip_to_azure, last_accessed
FROM oauth2_registered_client
WHERE client_id = 'hmpps-typescript-template-system';

------------------------------------------------------------------------------------------------
-- Client authorities (source of the JWT `authorities` claim for client-credentials tokens)
------------------------------------------------------------------------------------------------

-- registered_client_id must match the oauth2_registered_client.id used for the system client above
INSERT INTO oauth2_authorization_consent (registered_client_id, principal_name, authorities)
VALUES ('c57a0002-0000-4000-a000-000000000002', 'hmpps-cell-sharing-risk-assessment-ui-system',
        'ROLE_CSRA_REVIEW__R,ROLE_CSRA_REVIEW__RW,ROLE_PRISONER_CSRA__ADMIN,'
            || 'ROLE_PRISON_API__SPLASH_SCREEN__RO,ROLE_PRISON_API__SPLASH_SCREEN__RW,'
            || 'PRISONER_SEARCH__PRISONER__RO');

-- The API's own client: prisoner-search roll reads and prison-api movements (ROLE_ESTABLISHMENT_ROLL).
-- The local WireMock stubs don't check the token, but the roles keep the local JWT the same shape as
-- the deployed one.
INSERT INTO oauth2_authorization_consent (registered_client_id, principal_name, authorities)
VALUES ('c57a0003-0000-4000-a000-000000000003', 'hmpps-cell-sharing-risk-assessment-api',
        'ROLE_PRISONER_SEARCH,ROLE_ESTABLISHMENT_ROLL,PRISONER_SEARCH__PRISONER__RO');

------------------------------------------------------------------------------------------------
-- User roles
------------------------------------------------------------------------------------------------

-- The rollout admin console is gated on the *user* role CSRA__ADMIN, which is a separate set from
-- the system roles above: user roles gate screens, system roles gate the API. hmpps-auth stores the
-- code unprefixed and emits ROLE_CSRA__ADMIN in the token, which the UI strips back to CSRA__ADMIN.
-- Granted to AUTH_USER, the account the README tells you to sign in with locally.
INSERT INTO roles (role_id, role_code, role_name, role_description, admin_type)
VALUES ('c57a0004-0000-4000-a000-000000000004', 'CSRA__ADMIN', 'CSRA rollout admin', null, 'DPS_ADM');

INSERT INTO user_role (role_id, user_id)
SELECT role_id, user_id
FROM roles, users
WHERE username = 'AUTH_USER'
  AND role_code = 'CSRA__ADMIN';

-- The two CSRA edit roles. Nothing enforces them yet - the write journeys do not exist - but seeding
-- them keeps local dev matching production, so those journeys work here the day they are built.
INSERT INTO roles (role_id, role_code, role_name, role_description, admin_type)
VALUES ('c57a0005-0000-4000-a000-000000000005', 'CSRA__ASSESSMENT_EDIT', 'Edit CSRA assessments', null, 'DPS_ADM'),
       ('c57a0006-0000-4000-a000-000000000006', 'CSRA__REVIEW_EDIT', 'Edit CSRA reviews', null, 'DPS_ADM');

INSERT INTO user_role (role_id, user_id)
SELECT role_id, user_id
FROM roles, users
WHERE username = 'AUTH_USER'
  AND role_code IN ('CSRA__ASSESSMENT_EDIT', 'CSRA__REVIEW_EDIT');
