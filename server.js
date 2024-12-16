"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("firebase/app");
const database_1 = require("firebase/database");
const discord_js_1 = require("discord.js");
const dotenv_1 = __importDefault(require("dotenv"));
const node_schedule_1 = __importDefault(require("node-schedule"));
const moment_timezone_1 = __importDefault(require("moment-timezone"));
const http_1 = __importDefault(require("http"));
dotenv_1.default.config();
// Initialize Firebase
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.FIREBASE_DATABASE_URL,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
};
const app = (0, app_1.initializeApp)(firebaseConfig);
const database = (0, database_1.getDatabase)(app);
// Initialize Discord client
const client = new discord_js_1.Client({
    intents: [discord_js_1.GatewayIntentBits.Guilds, discord_js_1.GatewayIntentBits.GuildMessages],
});
client.login(process.env.DISCORD_BOT_TOKEN);
function startDiscordBot(field, value, date) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!client.isReady()) {
            yield new Promise((resolve) => {
                client.once(discord_js_1.Events.ClientReady, () => resolve());
            });
        }
        const channel = client.channels.cache.get(process.env.DISCORD_CHANNEL_ID);
        const embed = new discord_js_1.EmbedBuilder();
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
        yield channel.send({ embeds: [embed] });
    });
}
function schedulePaymentTasks(payment, paymentKey) {
    if (!payment)
        return;
    const paymentDate = (0, moment_timezone_1.default)(payment.date);
    if (paymentDate.isAfter((0, moment_timezone_1.default)())) {
        node_schedule_1.default.scheduleJob(paymentDate.toDate(), () => __awaiter(this, void 0, void 0, function* () {
            yield startDiscordBot("payments", payment.description, paymentDate.toDate());
            // Update the status to "success" in Firebase
            yield (0, database_1.update)((0, database_1.ref)(database, `payments/${paymentKey}`), {
                status: "success",
            });
        }));
    }
}
// Set up Firebase listeners
const currentStateRef = (0, database_1.ref)(database, "currentState");
(0, database_1.onValue)(currentStateRef, (snapshot) => {
    const currentState = snapshot.val();
    // console.log('Current state:', currentState);
    // Handle distance updates
    if (currentState.dist < 100) {
        startDiscordBot("dist", currentState.dist, new Date(currentState.timestamp));
    }
    // Handle motion updates
    if (currentState.motion) {
        startDiscordBot("motion", 1, new Date(currentState.timestamp));
    }
    // Handle smoke updates
    if (currentState.smk >= 1000) {
        startDiscordBot("smoke", currentState.smk, new Date(currentState.timestamp));
    }
});
// Set up payments listener
const paymentsRef = (0, database_1.ref)(database, "payments");
(0, database_1.onValue)(paymentsRef, (snapshot) => {
    const paymentsData = snapshot.val();
    node_schedule_1.default.gracefulShutdown();
    Object.keys(paymentsData).forEach((paymentKey) => {
        schedulePaymentTasks(paymentsData[paymentKey], paymentKey);
    });
});
const server = http_1.default.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Discord Bot is running");
});
const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
console.log("Backend service started");
