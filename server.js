import { initializeApp } from 'firebase/app';
import {
  getDatabase,
  ref,
  onValue,
  update,
} from "firebase/database"
import { Client, GatewayIntentBits, TextChannel, EmbedBuilder, Events } from 'discord.js';
import dotenv from 'dotenv';
import schedule from 'node-schedule';
import moment from 'moment-timezone';

dotenv.config();

// Initialize Firebase
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.FIREBASE_DATABASE_URL,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Initialize Discord client
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

client.login(process.env.DISCORD_BOT_TOKEN);

async function startDiscordBot(field, value, date) {
  if (!client.isReady()) {
    await new Promise((resolve) => {
      client.once(Events.ClientReady, () => resolve())
    })
  }

  const channel = client.channels.cache.get(process.env.DISCORD_CHANNEL_ID);
  const embed = new EmbedBuilder();

  switch (field) {
    case "dist":
      embed
        .setColor(0xa1fff0)
        .setTitle("Distance Value Update")
        .setDescription(`The distance value has been updated.`)
        .addFields({
          name: "New Value",
          value: value.toString(),
        })
        .setTimestamp(date);
      break;
    case "smoke":
      embed
        .setColor(0xff0000)
        .setTitle("Smoke Value Update")
        .setDescription(`The smoke value has been updated.`)
        .addFields({
          name: "New Value",
          value: value.toString(),
        })
        .setTimestamp(date);
      break;
    case "motion":
      embed
        .setColor(0xa1fff0)
        .setTitle("Motion Value Update")
        .setDescription(`The motion value has been updated.`)
        .addFields({
          name: "New Value",
          value: value ? "✅ Detected" : "❌ Not Detected",
        })
        .setTimestamp(date);
      break;
    case "payments":
      embed
        .setColor(0xa1fff0)
        .setTitle("Task Update")
        .setDescription(`The task value has been updated.`)
        .addFields({
          name: "New Value",
          value: value.toString(),
        })
        .setTimestamp(date);
      break;
    default:
      break;
  }

  await channel.send({ embeds: [embed] });
}

function schedulePaymentTasks(payment, paymentKey) {
  if (!payment) return;

  const paymentDate = moment(payment.date);

  if (paymentDate.isAfter(moment())) {
    schedule.scheduleJob(paymentDate.toDate(), async () => {
      await startDiscordBot('payments', payment.description, paymentDate.toDate());
      // Update the status to "success" in Firebase
      await update(ref(database, `payments/${paymentKey}`), {
        status: "success",
      })
    });
  }
}

// Set up Firebase listeners
const currentStateRef = ref(database, 'currentState');
onValue(currentStateRef, (snapshot) => {
  const currentState = snapshot.val();
  // console.log('Current state:', currentState);
  // Handle distance updates
  if (currentState.dist < 100) {
    startDiscordBot('dist', currentState.dist, new Date(currentState.timestamp));
  }

  // Handle motion updates
  if (currentState.motion) {
    startDiscordBot('motion', 1, new Date(currentState.timestamp));
  }

  // Handle smoke updates
  if (currentState.smk >= 1000) {
    startDiscordBot('smoke', currentState.smk, new Date(currentState.timestamp));
  }
});

// Set up payments listener
const paymentsRef = ref(database, 'payments');
onValue(paymentsRef, (snapshot) => {
  const paymentsData = snapshot.val();
  schedule.gracefulShutdown();
  Object.keys(paymentsData).forEach((paymentKey) => {
    schedulePaymentTasks(paymentsData[paymentKey], paymentKey);
  });
});

console.log('Backend service started');