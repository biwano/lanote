-- Stable learner identity: PRONOTE instance URL + user resource id (ParametresUtilisateur.ressource.N).

alter table learners
  add column if not exists pronote_server text,
  add column if not exists pronote_user_id text;

alter table learners
  drop constraint if exists learners_pronote_account_hash_key;

create unique index if not exists learners_pronote_identity_uidx
  on learners (pronote_server, pronote_user_id);
