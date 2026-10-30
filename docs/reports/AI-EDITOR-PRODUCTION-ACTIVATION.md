# AI editor activation checkpoint

This is a proposed activation scope, **not permission to execute it**. Production remains 20261030.1. No new credentials or production AI configuration were created.

## Facts and first dependency

The existing local encrypted Bridge connection advertised gpt-6.1-sol; a synthetic text marker passed using a temporary model override. The old configured gpt-5.3-codex was absent and returned404. That previous probe used the existing HTTP endpoint. Subsequent work must not send credentials over remote HTTP; the new gateway code fails closed for remote HTTP and keeps loopback HTTP only for isolated tests.

The configured address is http://ccnode.briconbric.com:49530/v1. Anonymous certificate-validated https://ccnode.briconbric.com/v1/models returned200 but **not model JSON**, so it is not a verified secure API base. No credential was sent to it. A valid existing HTTPS API base must first be supplied or verified by the gateway owner. Do not guess URL variants, disable certificate checks, alter another service's proxy, or inject the HTTP address into production.

The existing encrypted Brave search credential could not be initialized in the isolated probe. No search API request was sent. Do not manufacture results or substitute another key. A supported secure handoff of a valid existing search credential is a separate dependency; no new key is requested automatically.

## Proposed Bobuy-only persistent configuration, after endpoint verification and specific approval

* Target: existing Bobuy host185.184.223.41, existing bobuy-ai-service. No new accounts, tokens, IAM privileges, listener ports or public buckets.
* Reuse only the selected existing Bridge credential and verified HTTPS base; model gpt-6.1-sol, subject to real text/vision capability tests over that secure base. Do not assume text capability proves images.
* Allowlisted encrypted credential fields only in /opt/bobuy/secrets/ai/bridge.env, root-owned0400; decryption master in separate /opt/bobuy/secrets/ai/bridge-master.env, root-owned0400. Docker reads these existing env-file conventions only for ai-service; do not copy the complete local .env or expose secrets to frontend/core/CI/Git/images/logs. Container environment is readable to the host Docker administrator; this is part of the explicit persistent-access risk.
* Before writing, prove secure recovery using the existing supported current-user DPAPI sealing mechanism, proposed non-synced OHR path C:\Users\X02851\AppData\Local\Bobuy\Secure\ai-bridge.dpapi with strict owner ACL. This would be a new recovery copy and requires specific approval; none exists yet. Preserve the original source. No plaintext chat handoff.
* Activate only after tests and review: update the ai-service allowlisted provider/base/model/environment references and restart that service. Core/frontend code deployment is separate; no database migration or product content update. Exact restart duration must be measured, not invented.
* Rollback: restore prior Compose/environment references and prior ai-service image, restart and verify health; keep the sealed recovery material. Do not revoke/reset the shared existing credential or affect other consumers. No physical deletion.

The endpoint dependency means this is **not yet an executable production command**. Obtain the correct secure base first; request specific persistent-configuration approval with that actual destination, not an unknown URL or a blanket reuse question.

## Evidence boundary

Unit, H2/MockMvc and real local browser tests use explicit synthetic fixtures. They prove UI, transaction and permission behavior, not production AI, real vision recognition, or authenticated search availability. Existing production content, post4's three saved associations, prices, stock and publish state remain unchanged.
