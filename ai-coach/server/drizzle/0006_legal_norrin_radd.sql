-- DEFAULT 1 aggiunto a mano: drizzle-kit genera "ADD is_active integer
-- NOT NULL" senza default, e SQLite rifiuta una colonna NOT NULL priva
-- di default su una tabella che contiene gia' delle righe. Qui la
-- tabella e' vuota, ma la migrazione viene rieseguita su qualunque
-- altro database. Il valore 1 e' coerente con il default applicativo
-- dichiarato nello schema.
ALTER TABLE `setups` ADD `is_active` integer DEFAULT 1 NOT NULL;
