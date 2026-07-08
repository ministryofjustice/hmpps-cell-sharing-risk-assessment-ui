-- Local-dev only: seed HMPPS Auth with CSRA UI OAuth clients.
--
-- This migration is mounted into the dockerised hmpps-auth (dev profile / H2 in-memory)
-- via a `filesystem:` flyway location (see SPRING_FLYWAY_LOCATIONS in docker-compose.yml).
-- It runs after the built-in V900_* dev seed, so the `hmpps-typescript-template*` rows it
-- clones from already exist.
--
-- Two clients are created, mirroring production wiring:
--   * hmpps-cell-sharing-risk-assessment-ui         - authorization_code (user login)
--   * hmpps-cell-sharing-risk-assessment-ui-system  - client_credentials (system->API calls),
--       granted the CSRA API roles ROLE_CSRA_REVIEW__R / ROLE_CSRA_REVIEW__RW and the
--       prisoner-search read role PRISONER_SEARCH__PRISONER__RO.
--
-- Each client is stored in the legacy `oauth_client_details` table and the Spring
-- Authorization Server `oauth2_registered_client` table. We clone the template rows with
-- INSERT ... SELECT so all the fiddly settings/JSON columns are copied verbatim.
--
-- IMPORTANT: for client-credentials tokens, hmpps-auth's TokenCustomizer sources the JWT
-- `authorities` claim from the `oauth2_authorization_consent` table (keyed by the registered
-- client id + client id), NOT from `oauth_client_details.authorities`. So the system client
-- also needs a consent row carrying the CSRA roles.
--
-- Secret for both clients is the dev default `clientsecret`.

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
       'ROLE_CSRA_REVIEW__R,ROLE_CSRA_REVIEW__RW',
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

------------------------------------------------------------------------------------------------
-- Client authorities (source of the JWT `authorities` claim for client-credentials tokens)
------------------------------------------------------------------------------------------------

-- registered_client_id must match the oauth2_registered_client.id used for the system client above
INSERT INTO oauth2_authorization_consent (registered_client_id, principal_name, authorities)
VALUES ('c57a0002-0000-4000-a000-000000000002', 'hmpps-cell-sharing-risk-assessment-ui-system',
        'ROLE_CSRA_REVIEW__R,ROLE_CSRA_REVIEW__RW,PRISONER_SEARCH__PRISONER__RO');
