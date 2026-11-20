-- ImmoPilot AI — tests d'attaque de l'isolation entre agences.
-- Exécuté avec le rôle applicatif app_user (non propriétaire, sans contournement RLS).
-- Chaque test affiche « OK » ou lève une erreur contenant « ÉCHEC ».
--
-- Volumes (voir schema.sql) : agence A = 100 003 contacts (dont « A1 privé », « A1 agence »,
-- « A2 privé ») ; agence B = 100 001 contacts (dont « B1 agence »).
-- Identifiants : agence A = aaaaaaaa-…, agence B = bbbbbbbb-… ;
-- utilisateurs GA (gérant A) = …a0, A1 = …a1, A2 = …a2 (négociateurs A), B1 = …b1.

\set ON_ERROR_STOP 0

-- T1 : sans contexte, rien n'est visible.
DO $$ DECLARE n bigint; BEGIN
  SELECT count(*) INTO n FROM app.contacts;
  IF n <> 0 THEN RAISE EXCEPTION 'ÉCHEC T1 : % lignes visibles sans contexte', n; END IF;
  RAISE NOTICE 'OK T1  sans contexte : 0 ligne visible';
END $$;

-- T2 : sans contexte, aucune écriture.
DO $$ BEGIN
  BEGIN
    INSERT INTO app.contacts (org_id, owner_user_id, visibility, full_name)
    VALUES ('aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a1', 'private', 'intrus');
    RAISE EXCEPTION 'ÉCHEC T2 : insertion acceptée sans contexte';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'OK T2  sans contexte : insertion refusée';
  END;
END $$;

-- T3 : un négociateur voit ses contacts et ceux partagés avec l'agence, pas les contacts privés
-- d'un collègue, et rien de l'agence B.
DO $$ DECLARE tot bigint; a1p bigint; a2p bigint; b bigint; BEGIN
  PERFORM set_config('app.org_id',  'aaaaaaaa-0000-0000-0000-000000000000', true);
  PERFORM set_config('app.user_id', '00000000-0000-0000-0000-0000000000a1', true);
  SELECT count(*) INTO tot FROM app.contacts;
  SELECT count(*) INTO a1p FROM app.contacts WHERE full_name = 'A1 privé';
  SELECT count(*) INTO a2p FROM app.contacts WHERE full_name = 'A2 privé';
  SELECT count(*) INTO b   FROM app.contacts WHERE org_id = 'bbbbbbbb-0000-0000-0000-000000000000';
  IF tot <> 100002 OR a1p <> 1 OR a2p <> 0 OR b <> 0 THEN
    RAISE EXCEPTION 'ÉCHEC T3 : total=% A1privé=% A2privé=% agenceB=%', tot, a1p, a2p, b;
  END IF;
  RAISE NOTICE 'OK T3  négociateur A1 : 100 002 visibles, privé du collègue masqué, agence B invisible';
END $$;

-- T4 : le gérant voit tout son agence (y compris les contacts privés), rien de l'agence B.
DO $$ DECLARE tot bigint; a2p bigint; b bigint; BEGIN
  PERFORM set_config('app.org_id',  'aaaaaaaa-0000-0000-0000-000000000000', true);
  PERFORM set_config('app.user_id', '00000000-0000-0000-0000-0000000000a0', true);
  SELECT count(*) INTO tot FROM app.contacts;
  SELECT count(*) INTO a2p FROM app.contacts WHERE full_name = 'A2 privé';
  SELECT count(*) INTO b   FROM app.contacts WHERE org_id = 'bbbbbbbb-0000-0000-0000-000000000000';
  IF tot <> 100003 OR a2p <> 1 OR b <> 0 THEN
    RAISE EXCEPTION 'ÉCHEC T4 : total=% A2privé=% agenceB=%', tot, a2p, b;
  END IF;
  RAISE NOTICE 'OK T4  gérant A : toute l''agence A (100 003), agence B invisible';
END $$;

-- T5 : un bug applicatif place A1 dans l'agence B (dont il n'est pas membre) : rien n'est visible.
DO $$ DECLARE n bigint; o bigint; BEGIN
  PERFORM set_config('app.org_id',  'bbbbbbbb-0000-0000-0000-000000000000', true);
  PERFORM set_config('app.user_id', '00000000-0000-0000-0000-0000000000a1', true);
  SELECT count(*) INTO n FROM app.contacts;
  SELECT count(*) INTO o FROM app.organizations;
  IF n <> 0 OR o <> 0 THEN RAISE EXCEPTION 'ÉCHEC T5 : contacts=% organisations=%', n, o; END IF;
  RAISE NOTICE 'OK T5  contexte d''une agence dont on n''est pas membre : 0 ligne';
END $$;

-- T6 : depuis l'agence A, écrire une ligne dans l'agence B est refusé.
DO $$ BEGIN
  PERFORM set_config('app.org_id',  'aaaaaaaa-0000-0000-0000-000000000000', true);
  PERFORM set_config('app.user_id', '00000000-0000-0000-0000-0000000000a0', true);
  BEGIN
    INSERT INTO app.contacts (org_id, owner_user_id, visibility, full_name)
    VALUES ('bbbbbbbb-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a0', 'agency', 'intrus');
    RAISE EXCEPTION 'ÉCHEC T6 : insertion dans l''agence B acceptée';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'OK T6  insertion dans une autre agence refusée';
  END;
END $$;

-- T7 : déplacer un contact vers l'agence B est refusé.
DO $$ BEGIN
  PERFORM set_config('app.org_id',  'aaaaaaaa-0000-0000-0000-000000000000', true);
  PERFORM set_config('app.user_id', '00000000-0000-0000-0000-0000000000a0', true);
  BEGIN
    UPDATE app.contacts SET org_id = 'bbbbbbbb-0000-0000-0000-000000000000' WHERE full_name = 'A1 agence';
    RAISE EXCEPTION 'ÉCHEC T7 : déplacement vers l''agence B accepté';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'OK T7  déplacement d''un contact vers une autre agence refusé';
  END;
END $$;

-- T8 : modifier ou supprimer une ligne de l'agence B en la visant directement n'a aucun effet.
DO $$ DECLARE u bigint; d bigint; own bigint; BEGIN
  PERFORM set_config('app.org_id',  'aaaaaaaa-0000-0000-0000-000000000000', true);
  PERFORM set_config('app.user_id', '00000000-0000-0000-0000-0000000000a0', true);
  -- Contrôle positif : le gérant peut bien modifier un contact de SON agence.
  UPDATE app.contacts SET full_name = full_name WHERE full_name = 'A1 agence';
  GET DIAGNOSTICS own = ROW_COUNT;
  UPDATE app.contacts SET full_name = 'piraté' WHERE full_name = 'B1 agence';
  GET DIAGNOSTICS u = ROW_COUNT;
  DELETE FROM app.contacts WHERE full_name = 'B1 agence';
  GET DIAGNOSTICS d = ROW_COUNT;
  IF own <> 1 OR u <> 0 OR d <> 0 THEN
    RAISE EXCEPTION 'ÉCHEC T8 : propre agence=% (attendu 1) modifiées B=% supprimées B=%', own, u, d;
  END IF;
  RAISE NOTICE 'OK T8  le gérant modifie son agence (contrôle positif) mais 0 ligne touchée dans l''agence B';
END $$;

-- T9 : un négociateur ne modifie pas le contact d'un collègue (même partagé) et ne supprime rien.
DO $$ DECLARE u1 bigint; u2 bigint; d bigint; own bigint; BEGIN
  PERFORM set_config('app.org_id',  'aaaaaaaa-0000-0000-0000-000000000000', true);
  PERFORM set_config('app.user_id', '00000000-0000-0000-0000-0000000000a2', true);
  -- Contrôle positif : A2 peut modifier SON propre contact.
  UPDATE app.contacts SET full_name = full_name WHERE full_name = 'A2 privé';
  GET DIAGNOSTICS own = ROW_COUNT;
  UPDATE app.contacts SET full_name = 'modifié' WHERE full_name = 'A1 agence';
  GET DIAGNOSTICS u1 = ROW_COUNT;
  UPDATE app.contacts SET full_name = 'modifié' WHERE full_name = 'A1 privé';
  GET DIAGNOSTICS u2 = ROW_COUNT;
  DELETE FROM app.contacts WHERE full_name = 'A2 privé';
  GET DIAGNOSTICS d = ROW_COUNT;
  IF own <> 1 OR u1 <> 0 OR u2 <> 0 OR d <> 0 THEN
    RAISE EXCEPTION 'ÉCHEC T9 : propre=% (attendu 1) u1=% u2=% d=%', own, u1, u2, d;
  END IF;
  RAISE NOTICE 'OK T9  négociateur A2 : modifie le sien (contrôle positif), pas ceux de A1, ne supprime pas';
END $$;

-- T10 : le contexte d'une transaction ne fuit pas dans la suivante (connexion réutilisée).
DO $$ BEGIN
  PERFORM set_config('app.org_id',  'aaaaaaaa-0000-0000-0000-000000000000', true);
  PERFORM set_config('app.user_id', '00000000-0000-0000-0000-0000000000a0', true);
END $$;
DO $$ DECLARE n bigint; BEGIN
  SELECT count(*) INTO n FROM app.contacts;
  IF n <> 0 OR coalesce(current_setting('app.org_id', true), '') <> '' THEN
    RAISE EXCEPTION 'ÉCHEC T10 : contexte encore actif (% lignes)', n;
  END IF;
  RAISE NOTICE 'OK T10 contexte limité à la transaction : rien ne fuit dans la suivante';
END $$;

-- T11 : contre-exemple documenté. Un réglage au niveau de la SESSION (is_local = false)
-- fuit dans les requêtes suivantes : c'est pourquoi l'application doit toujours utiliser
-- le mode transaction. Ce test vérifie que la fuite existe bien, puis nettoie.
DO $$ BEGIN
  PERFORM set_config('app.org_id',  'aaaaaaaa-0000-0000-0000-000000000000', false);
  PERFORM set_config('app.user_id', '00000000-0000-0000-0000-0000000000a0', false);
END $$;
DO $$ DECLARE n bigint; BEGIN
  SELECT count(*) INTO n FROM app.contacts;
  IF n = 0 THEN RAISE EXCEPTION 'ÉCHEC T11 : la fuite attendue en mode session n''apparaît pas'; END IF;
  RAISE NOTICE 'OK T11 confirmé : le mode session FUIT (% lignes) — interdit dans le code', n;
END $$;
RESET app.org_id;
RESET app.user_id;

-- T12 : le rôle applicatif ne peut ni désactiver la RLS, ni prendre le rôle propriétaire,
-- ni s'ajouter dans une autre agence.
DO $$ BEGIN
  BEGIN
    ALTER TABLE app.contacts DISABLE ROW LEVEL SECURITY;
    RAISE EXCEPTION 'ÉCHEC T12 : RLS désactivée par le rôle applicatif';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    SET LOCAL ROLE app_owner;
    RAISE EXCEPTION 'ÉCHEC T12 : rôle propriétaire obtenu';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO app.memberships VALUES
      ('00000000-0000-0000-0000-0000000000a1', 'bbbbbbbb-0000-0000-0000-000000000000', 'gerant');
    RAISE EXCEPTION 'ÉCHEC T12 : adhésion à une autre agence créée';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'OK T12 rôle applicatif : RLS non désactivable, pas de rôle propriétaire, pas d''auto-adhésion';
END $$;

-- Mesure : comptage de 100 003 lignes avec toutes les politiques actives (gérant A).
BEGIN;
SELECT set_config('app.org_id',  'aaaaaaaa-0000-0000-0000-000000000000', true) \gset
SELECT set_config('app.user_id', '00000000-0000-0000-0000-0000000000a0', true) \gset
EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY ON) SELECT count(*) FROM app.contacts;
COMMIT;
