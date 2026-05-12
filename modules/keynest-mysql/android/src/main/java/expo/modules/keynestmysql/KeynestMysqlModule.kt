package expo.modules.keynestmysql

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.sql.Connection
import java.sql.DriverManager
import java.sql.PreparedStatement
import java.sql.ResultSet
import java.sql.SQLException
import java.sql.Timestamp
import java.time.Instant
import java.time.format.DateTimeFormatter
import java.util.Calendar
import java.util.TimeZone

private data class MysqlConnParams(
  val host: String,
  val port: Int,
  val user: String,
  val password: String,
  val database: String,
  val sslMode: String,
) {
  fun jdbcUrl(): String {
    val encodedDb = java.net.URLEncoder.encode(database, "UTF-8")
    val params = listOf(
      "sslMode=$sslMode",
      "allowPublicKeyRetrieval=true",
      "serverTimezone=UTC",
      "connectTimeout=5000",
      "socketTimeout=8000",
      "characterEncoding=UTF-8",
      "useUnicode=true",
    ).joinToString("&")
    return "jdbc:mysql://$host:$port/$encodedDb?$params"
  }
}

private fun parseCfg(cfg: Map<String, Any?>): MysqlConnParams {
  val host = (cfg["host"] as? String)?.trim().orEmpty()
  require(host.isNotEmpty()) { "host is required" }
  val portRaw = cfg["port"]
  val port = when (portRaw) {
    is Number -> portRaw.toInt()
    is String -> portRaw.toIntOrNull() ?: 3306
    else -> 3306
  }
  val user = (cfg["user"] as? String).orEmpty()
  val password = (cfg["password"] as? String).orEmpty()
  val database = (cfg["database"] as? String)?.trim().orEmpty()
  require(database.isNotEmpty()) { "database is required" }
  val sslMode = when ((cfg["sslMode"] as? String)?.uppercase()) {
    "DISABLED" -> "DISABLED"
    else -> "REQUIRED"
  }
  return MysqlConnParams(host, port, user, password, database, sslMode)
}

private fun ensureDriverLoaded() {
  try {
    Class.forName("com.mysql.cj.jdbc.Driver")
  } catch (_: ClassNotFoundException) {
    // ignore — the driver registers itself via ServiceLoader on modern versions
  }
}

private fun openConnection(p: MysqlConnParams): Connection {
  ensureDriverLoaded()
  return DriverManager.getConnection(p.jdbcUrl(), p.user, p.password)
}

private const val DDL_CREATE = """
  CREATE TABLE IF NOT EXISTS mfa_accounts (
    id VARCHAR(64) PRIMARY KEY,
    uri TEXT NOT NULL,
    name VARCHAR(255) NOT NULL,
    issuer VARCHAR(255) DEFAULT '',
    secret VARCHAR(512) NOT NULL,
    algorithm VARCHAR(10) DEFAULT 'SHA1',
    digits INT DEFAULT 6,
    period INT DEFAULT 30,
    type VARCHAR(10) DEFAULT 'totp',
    counter INT DEFAULT 0,
    pinned TINYINT(1) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )
"""

private fun ensureTable(conn: Connection) {
  conn.createStatement().use { it.execute(DDL_CREATE.trimIndent()) }
}

private fun tsToIso(ts: Timestamp?): String {
  if (ts == null) return ""
  return DateTimeFormatter.ISO_INSTANT.format(Instant.ofEpochMilli(ts.time))
}

private val UTC_CAL: Calendar get() = Calendar.getInstance(TimeZone.getTimeZone("UTC"))

private fun isoToTimestamp(value: String?): Timestamp {
  val iso = value?.takeIf { it.isNotEmpty() }
  val instant = try {
    if (iso != null) Instant.parse(iso) else Instant.now()
  } catch (_: Throwable) {
    Instant.now()
  }
  return Timestamp.from(instant)
}

private fun toAccountMap(rs: ResultSet): Map<String, Any?> = mapOf(
  "id" to rs.getString("id"),
  "uri" to (rs.getString("uri") ?: ""),
  "name" to (rs.getString("name") ?: ""),
  "issuer" to (rs.getString("issuer") ?: ""),
  "secret" to rs.getString("secret"),
  "algorithm" to (rs.getString("algorithm") ?: "SHA1"),
  "digits" to rs.getInt("digits"),
  "period" to rs.getInt("period"),
  "type" to (rs.getString("type") ?: "totp"),
  "counter" to rs.getInt("counter"),
  "pinned" to (rs.getInt("pinned") == 1),
  "createdAt" to tsToIso(rs.getTimestamp("created_at", UTC_CAL)),
  "updatedAt" to tsToIso(rs.getTimestamp("updated_at", UTC_CAL)),
)

private fun bindAccount(ps: PreparedStatement, a: Map<String, Any?>) {
  ps.setString(1, a["id"] as String)
  ps.setString(2, (a["uri"] as? String).orEmpty())
  ps.setString(3, (a["name"] as? String) ?: "Unknown")
  ps.setString(4, (a["issuer"] as? String).orEmpty())
  ps.setString(5, a["secret"] as String)
  ps.setString(6, (a["algorithm"] as? String) ?: "SHA1")
  ps.setInt(7, ((a["digits"] as? Number)?.toInt()) ?: 6)
  ps.setInt(8, ((a["period"] as? Number)?.toInt()) ?: 30)
  ps.setString(9, (a["type"] as? String) ?: "totp")
  ps.setInt(10, ((a["counter"] as? Number)?.toInt()) ?: 0)
  ps.setInt(11, if (a["pinned"] as? Boolean == true) 1 else 0)
  ps.setTimestamp(12, isoToTimestamp(a["createdAt"] as? String), UTC_CAL)
  ps.setTimestamp(13, isoToTimestamp(a["updatedAt"] as? String), UTC_CAL)
}

private const val SQL_UPSERT = """
  INSERT INTO mfa_accounts (id, uri, name, issuer, secret, algorithm, digits, period, type, counter, pinned, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON DUPLICATE KEY UPDATE
    uri=VALUES(uri), name=VALUES(name), issuer=VALUES(issuer), secret=VALUES(secret),
    algorithm=VALUES(algorithm), digits=VALUES(digits), period=VALUES(period),
    type=VALUES(type), counter=VALUES(counter), pinned=VALUES(pinned),
    updated_at=VALUES(updated_at)
"""

class KeynestMysqlModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("KeynestMysql")

    AsyncFunction("testConnection") { cfg: Map<String, Any?> ->
      try {
        val params = parseCfg(cfg)
        openConnection(params).use { conn ->
          conn.createStatement().use { st ->
            st.executeQuery("SELECT 1").close()
          }
        }
        mapOf("ok" to true)
      } catch (e: SQLException) {
        mapOf("ok" to false, "error" to (e.message ?: "SQL error"))
      } catch (e: Throwable) {
        mapOf("ok" to false, "error" to (e.message ?: e::class.java.simpleName))
      }
    }

    AsyncFunction("getAllAccounts") { cfg: Map<String, Any?> ->
      val params = parseCfg(cfg)
      val out = ArrayList<Map<String, Any?>>()
      openConnection(params).use { conn ->
        ensureTable(conn)
        conn.prepareStatement("SELECT * FROM mfa_accounts ORDER BY pinned DESC, name ASC").use { ps ->
          ps.executeQuery().use { rs ->
            while (rs.next()) out.add(toAccountMap(rs))
          }
        }
      }
      out
    }

    AsyncFunction("upsertAccount") { cfg: Map<String, Any?>, account: Map<String, Any?> ->
      val params = parseCfg(cfg)
      openConnection(params).use { conn ->
        ensureTable(conn)
        conn.prepareStatement(SQL_UPSERT.trimIndent()).use { ps ->
          bindAccount(ps, account)
          ps.executeUpdate()
        }
      }
      true
    }

    AsyncFunction("deleteAccount") { cfg: Map<String, Any?>, id: String ->
      val params = parseCfg(cfg)
      openConnection(params).use { conn ->
        ensureTable(conn)
        conn.prepareStatement("DELETE FROM mfa_accounts WHERE id=?").use { ps ->
          ps.setString(1, id)
          ps.executeUpdate()
        }
      }
      true
    }
  }
}
