const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');
const functions = require('firebase-functions');

initializeApp();
const db = getFirestore();
const messaging = getMessaging();

// ✅ Notification: New Appointment
exports.notifyDoctorNewAppointment = onDocumentCreated(
  {
    document: 'appointments/{appointmentId}',
    region: 'asia-southeast1',
  },
  async (event) => {
    logger.info("🕒 New appointment created at:", new Date().toISOString());

    const appointment = event.data.data();
    const doctorId = appointment.doctorId;

    const doctorDoc = await db.collection('users').doc(doctorId).get();
    if (!doctorDoc.exists) {
      logger.error("❌ Doctor not found!");
      return;
    }

    const doctorToken = doctorDoc.data().fcmToken;
    logger.info("📲 Doctor's FCM Token:", doctorToken);

    try {
      await messaging.send({
        token: doctorToken,
        notification: {
          title: 'New Appointment',
          body: 'A patient has booked an appointment with you.',
        },
        data: {
          type: 'appointment',
          appointmentId: event.params.appointmentId,
        }
      });

      logger.info("✅ Notification sent successfully at:", new Date().toISOString());
    } catch (error) {
      logger.error("❌ Error sending notification:", error);
    }
  }
);

// ✅ Notification: General push
exports.sendPushNotification = onDocumentCreated(
  {
    document: 'notifications/{notificationId}',
    region: 'asia-southeast1',
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      logger.error("❌ No snapshot data available!");
      return;
    }

    const notification = snapshot.data();
    logger.info("📩 Sending notification:", notification);

    try {
      await messaging.send({
        token: notification.to,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: notification.data,
      });

      await snapshot.ref.delete();
      logger.info("🗑️ Notification document deleted after sending.");
    } catch (error) {
      logger.error("❌ Error sending push notification:", error);
    }
  }
);

// ✅ Agora Token Generator (v1 HTTPS Function)
const { RtcTokenBuilder, RtcRole } = require('agora-token');

const AGORA_APP_ID = 'a49de82128904c6db10e48851bba1b55';
const AGORA_CERTIFICATE = '1c43ce5759fc428e88d4ad9a4f89282e';

exports.generateAgoraToken = functions.https.onRequest((req, res) => {
  const channelName = req.query.channelName;
  if (!channelName) {
    return res.status(400).json({ error: "channelName is required" });
  }

  const uid = req.query.uid ? parseInt(req.query.uid) : 0;
  const role = req.query.role === "subscriber" ? RtcRole.SUBSCRIBER : RtcRole.PUBLISHER;
  const expireTime = req.query.expireTime ? parseInt(req.query.expireTime) : 3600;

  const currentTime = Math.floor(Date.now() / 1000);
  const privilegeExpireTime = currentTime + expireTime;

  const token = RtcTokenBuilder.buildTokenWithUid(
    AGORA_APP_ID, AGORA_CERTIFICATE, channelName, uid, role, privilegeExpireTime
  );

  return res.json({ token });
});
