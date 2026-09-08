package com.shnomano.call.data

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "contacts")
data class ContactEntity(
    @PrimaryKey val phone: String,
    val name: String,
    val linkedUserId: String? = null,
    val username: String? = null,
    val avatarUrl: String? = null,
    val isFriend: Boolean = false,
    val updatedAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "messages")
data class MessageEntity(
    @PrimaryKey val id: String,
    val conversationId: String,
    val senderId: String,
    val recipientId: String,
    val body: String,
    val createdAt: Long,
    val state: String = "sent"
)

@Dao
interface LocalDao {
    @Query("SELECT * FROM contacts ORDER BY name COLLATE NOCASE")
    fun observeContacts(): Flow<List<ContactEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveContacts(items: List<ContactEntity>)

    @Query("DELETE FROM contacts WHERE phone = :phone")
    suspend fun deleteContact(phone: String)

    @Query("SELECT * FROM messages WHERE conversationId = :conversationId ORDER BY createdAt")
    fun observeMessages(conversationId: String): Flow<List<MessageEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveMessages(items: List<MessageEntity>)
}

@Database(entities = [ContactEntity::class, MessageEntity::class], version = 1, exportSchema = false)
abstract class ShnoManoDatabase : RoomDatabase() {
    abstract fun localDao(): LocalDao

    companion object {
        @Volatile private var instance: ShnoManoDatabase? = null
        fun get(context: Context): ShnoManoDatabase = instance ?: synchronized(this) {
            instance ?: Room.databaseBuilder(
                context.applicationContext,
                ShnoManoDatabase::class.java,
                "shno_mano_call.db"
            ).fallbackToDestructiveMigration().build().also { instance = it }
        }
    }
}
