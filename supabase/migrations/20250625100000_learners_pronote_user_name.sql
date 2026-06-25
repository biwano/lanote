-- Rename identity column when 20250625000000 was applied with pronote_user_id.

alter table learners rename column pronote_user_id to pronote_user_name;

drop index if exists learners_pronote_identity_uidx;

create unique index if not exists learners_pronote_identity_uidx
  on learners (pronote_server, pronote_user_name);
