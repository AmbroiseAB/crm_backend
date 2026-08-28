import {Notification} from "../models/Notification.js";
import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";

export const createStoredNotification = ({owner, type, title, message, details = "", lead = null}) =>
  Notification.create({owner, type, title, message, details, lead});

export const getNotifications = asyncHandler(async (req, res) => {
  const notifications = await Notification.find({owner: req.user._id})
    .sort({createdAt: -1})
    .populate("lead", "name company");
  res.json({success: true, notifications, unreadCount: notifications.filter((item) => !item.read).length});
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    {_id: req.params.id, owner: req.user._id},
    {read: true},
    {new: true},
  );
  if (!notification) throw new ApiError(404, "Notification not found");
  res.json({success: true, notification});
});

export const clearNotifications = asyncHandler(async (req, res) => {
  await Notification.deleteMany({owner: req.user._id});
  res.json({success: true});
});

export const deleteNotification = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndDelete({_id: req.params.id, owner: req.user._id});
  if (!notification) throw new ApiError(404, "Notification not found");
  res.json({success: true});
});
