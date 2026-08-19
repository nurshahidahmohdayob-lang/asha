/* ═══════════ The database, behind one small interface ════════════════════
   server/data-api.ts decides WHO may touch WHAT — it verifies the Firebase
   token, pins ownership from that token and reads roles from the database.
   None of that changes with the database underneath it, so it stays there and
   the mechanics of talking to a database live here.

   Two drivers, chosen by environment:
     MySQL     when DATABASE_URL is set  (self-hosted: no quota caps at all)
     Supabase  when SUPABASE_URL and the service_role key are set
   Neither configured leaves the data API inert and the app on Firestore, which
   is the safe way round.

   Both store the same shape — the record exactly as the app writes it in a
   `data` JSON column, plus lifted copies of the fields that are filtered or
   sorted on — which is what lets one client-side store serve either. */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import mysql from "mysql2/promise";

export type Filter = [column: string, value: unknown];

export type ListArgs = {
  table: string;
  idCol: string;
  /** Equality filters the caller has already vetted. */
  filters: Filter[];
  /** Restrict to these ids. An empty array means "nothing", not "everything". */
  ids?: string[];
  /** id and updated_at only — what a watcher polls on. */
  stampsOnly?: boolean;
};

export interface DbDriver {
  readonly kind: "mysql" | "supabase";
  list(args: ListArgs): Promise<any[]>;
  get(table: string, idCol: string, id: string): Promise<any | null>;
  upsert(table: string, idCol: string, record: Record<string, any>): Promise<void>;
  update(
    table: string,
    idCol: string,
    id: string,
    changes: Record<string, any>,
    owner?: Filter,
  ): Promise<void>;
  remove(table: string, idCol: string, id: string, owner?: Filter): Promise<void>;
  /** Throws if the database cannot be queried; that is what health reports. */
  ping(): Promise<void>;
  /** Whether this table has the updated_at change marker.
   *
   *  It is optional on purpose. Adding it needs a migration run by hand, and
   *  until that happens writes must still work — stamping a column that is not
   *  there fails the whole write, which would mean no teacher could save. So
   *  the marker is used when present and skipped when not; watchers fall back
   *  to reading full rows, which costs bandwidth but is correct.
   *
   *  Answered once per table and remembered: it cannot change while running. */
  supportsStamps(table: string): Promise<boolean>;
}

/** Shared by both drivers — the question is asked once per table. */
function rememberPerTable(probe: (table: string) => Promise<boolean>) {
  const known = new Map<string, Promise<boolean>>();
  return (table: string): Promise<boolean> => {
    let answer = known.get(table);
    if (!answer) {
      answer = probe(table).catch(() => false);
      known.set(table, answer);
    }
    return answer;
  };
}

/** MySQL wants JSON columns written as strings and returns them parsed.
 *  Supabase handles both ends itself. */
const JSON_COLUMNS = new Set(["data", "roles"]);

/* ── MySQL ────────────────────────────────────────────────────────────── */

class MysqlDriver implements DbDriver {
  readonly kind = "mysql" as const;
  constructor(private pool: mysql.Pool) {}

  /** Identifiers come from this codebase and never from a request. Escaped
   *  anyway, so that stays true if one is ever threaded through. */
  private id(name: string): string {
    return `\`${String(name).replace(/`/g, "")}\``;
  }

  private encode(record: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(record)) {
      out[k] =
        JSON_COLUMNS.has(k) && v !== null && typeof v === "object"
          ? JSON.stringify(v)
          : v;
    }
    return out;
  }

  async list({ table, idCol, filters, ids, stampsOnly }: ListArgs): Promise<any[]> {
    const cols = stampsOnly ? `${this.id(idCol)}, \`updated_at\`` : "*";
    const where: string[] = [];
    const params: any[] = [];

    for (const [col, value] of filters) {
      where.push(`${this.id(col)} = ?`);
      params.push(value);
    }
    if (ids) {
      if (!ids.length) return [];
      where.push(`${this.id(idCol)} in (${ids.map(() => "?").join(",")})`);
      params.push(...ids);
    }

    const [rows] = await this.pool.query(
      `select ${cols} from ${this.id(table)}` +
        (where.length ? ` where ${where.join(" and ")}` : ""),
      params,
    );
    return rows as any[];
  }

  async get(table: string, idCol: string, id: string): Promise<any | null> {
    const [rows] = await this.pool.query(
      `select * from ${this.id(table)} where ${this.id(idCol)} = ? limit 1`,
      [id],
    );
    return (rows as any[])[0] ?? null;
  }

  async upsert(table: string, _idCol: string, record: Record<string, any>): Promise<void> {
    const row = this.encode(record);
    const cols = Object.keys(row);
    await this.pool.query(
      `insert into ${this.id(table)} (${cols.map((c) => this.id(c)).join(",")}) ` +
        `values (${cols.map(() => "?").join(",")}) ` +
        `on duplicate key update ` +
        cols.map((c) => `${this.id(c)} = values(${this.id(c)})`).join(","),
      cols.map((c) => row[c]),
    );
  }

  async update(
    table: string,
    idCol: string,
    id: string,
    changes: Record<string, any>,
    owner?: Filter,
  ): Promise<void> {
    const row = this.encode(changes);
    const cols = Object.keys(row);
    if (!cols.length) return;

    const params: any[] = [...cols.map((c) => row[c]), id];
    let sql =
      `update ${this.id(table)} set ${cols.map((c) => `${this.id(c)} = ?`).join(",")} ` +
      `where ${this.id(idCol)} = ?`;
    if (owner) {
      sql += ` and ${this.id(owner[0])} = ?`;
      params.push(owner[1]);
    }
    await this.pool.query(sql, params);
  }

  async remove(table: string, idCol: string, id: string, owner?: Filter): Promise<void> {
    const params: any[] = [id];
    let sql = `delete from ${this.id(table)} where ${this.id(idCol)} = ?`;
    if (owner) {
      sql += ` and ${this.id(owner[0])} = ?`;
      params.push(owner[1]);
    }
    await this.pool.query(sql, params);
  }

  async ping(): Promise<void> {
    await this.pool.query("select 1 from `users` limit 1");
  }

  supportsStamps = rememberPerTable(async (table: string) => {
    const [rows] = await this.pool.query(
      `select count(*) as n from information_schema.columns
       where table_schema = database() and table_name = ? and column_name = 'updated_at'`,
      [table],
    );
    return Number((rows as any[])[0]?.n) > 0;
  });
}

/* ── Supabase ─────────────────────────────────────────────────────────── */

class SupabaseDriver implements DbDriver {
  readonly kind = "supabase" as const;
  constructor(private sb: SupabaseClient) {}

  async list({ table, idCol, filters, ids, stampsOnly }: ListArgs): Promise<any[]> {
    let q = this.sb.from(table).select(stampsOnly ? `${idCol},updated_at` : "*");
    for (const [col, value] of filters) q = q.eq(col, value as any);
    if (ids) {
      if (!ids.length) return [];
      q = q.in(idCol, ids);
    }
    const { data, error } = await q;
    if (error) throw error;
    return (data as any[]) || [];
  }

  async get(table: string, idCol: string, id: string): Promise<any | null> {
    const { data, error } = await this.sb
      .from(table)
      .select("*")
      .eq(idCol, id)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  }

  async upsert(table: string, _idCol: string, record: Record<string, any>): Promise<void> {
    const { error } = await this.sb.from(table).upsert(record);
    if (error) throw error;
  }

  async update(
    table: string,
    idCol: string,
    id: string,
    changes: Record<string, any>,
    owner?: Filter,
  ): Promise<void> {
    let q = this.sb.from(table).update(changes).eq(idCol, id);
    if (owner) q = q.eq(owner[0], owner[1] as any);
    const { error } = await q;
    if (error) throw error;
  }

  async remove(table: string, idCol: string, id: string, owner?: Filter): Promise<void> {
    let q = this.sb.from(table).delete().eq(idCol, id);
    if (owner) q = q.eq(owner[0], owner[1] as any);
    const { error } = await q;
    if (error) throw error;
  }

  async ping(): Promise<void> {
    const { error } = await this.sb.from("users").select("uid").limit(1);
    if (error) throw error;
  }

  supportsStamps = rememberPerTable(async (table: string) => {
    // Asking for the column is the cheapest reliable probe; PostgREST answers
    // 42703 / PGRST204 when it does not exist.
    const { error } = await this.sb.from(table).select("updated_at").limit(1);
    return !error;
  });
}

/* ── Choosing one ─────────────────────────────────────────────────────── */

export function createDriver(): { driver: DbDriver | null; why: string } {
  const url = process.env.DATABASE_URL || "";
  if (url) {
    // With the SSH tunnel up this points at 127.0.0.1; the server it really
    // reaches is whatever that local port forwards to.
    const pool = mysql.createPool({
      uri: url,
      waitForConnections: true,
      connectionLimit: 10,
      supportBigNumbers: true,
      bigNumberStrings: false,
    });
    return { driver: new MysqlDriver(pool), why: "MySQL via DATABASE_URL" };
  }

  const sbUrl = process.env.SUPABASE_URL || "";
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (sbUrl && sbKey) {
    return {
      driver: new SupabaseDriver(
        createClient(sbUrl, sbKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        }),
      ),
      why: "Supabase via SUPABASE_URL",
    };
  }

  return { driver: null, why: "not configured" };
}
