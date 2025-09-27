const fs = require('fs');
const path = require('path');
const { filterQuery } = require('../commands/search.js');
const file = path.join(__dirname, '../../reminders.json');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

let reminders = [];

if (fs.existsSync(file)) {
  reminders = JSON.parse(fs.readFileSync(file, 'utf8'));
}

function save() {
  fs.writeFileSync(file, JSON.stringify(reminders, null, 2));
}

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

async function addReminder(r) {
  if (!r.dm) r.message = await filterQuery(r.message);

  const reminder = { id: generateId(), createdAt: Date.now(), ...r };
  reminders.push(reminder);
  save();
  return reminder;
}

function listReminders(userId) {
  return reminders.filter(r => r.userId === userId);
}

async function deleteReminder(userId, id) {
  const before = reminders.length;
  reminders = reminders.filter(r => !(r.userId === userId && r.id === id));
  save();
  return reminders.length < before;
}

function start(client) {
  setInterval(async () => {
    const now = Date.now();
    for (let i = 0; i < reminders.length; i++) {
      const r = reminders[i];
      if (now >= r.dueTime) {
        try {
          let sent = false;

          if (!r.dm) {
            const ch = await client.channels.fetch(r.channelId).catch(() => null);
            if (ch && ch.permissionsFor(client.user)?.has('SendMessages')) {
              r.message = await filterQuery(r.message);
              await ch.send(`<@${r.userId}> ⏰ Reminder: ${r.message}`);
              sent = true;
            }
          }

          if (!sent) {
            const user = await client.users.fetch(r.userId);
            const components = r.recurring ? [
              new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId(`deleteReminder_${r.id}`)
                  .setLabel('Delete Reminder')
                  .setStyle(ButtonStyle.Danger)
              )
            ] : [];

            await user.send({ content: `⏰ Reminder: ${r.message}`, components }).catch(() => null);
          }
        } catch (e) {
          console.error('Reminder send failed', e);
        }

        if (r.recurring) {
          if (r.recurring.times == null || r.recurring.times > 1) {
            r.dueTime = now + r.recurring.intervalMs;
            if (r.recurring.times) r.recurring.times--;
          } else {
            reminders.splice(i, 1);
            i--;
          }
        } else {
          reminders.splice(i, 1);
          i--;
        }
      }
    }
    save();
  }, 60 * 1000);
}

module.exports = { start, addReminder, listReminders, deleteReminder };
