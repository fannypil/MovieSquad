const PREDEFINED_AVATARS = [
  {
    id: "default_avatar",
    url: "https://www.w3schools.com/howto/img_avatar.png",
    name: "Default Avatar",
  },
  {
    id: "avatar_1",
    url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&backgroundColor=b6e3f4",
    name: "Felix",
  },
  {
    id: "avatar_2",
    url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka&backgroundColor=c0aede",
    name: "Aneka",
  },
  {
    id: "avatar_3",
    url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Tigger&backgroundColor=d1d4f9",
    name: "Tigger",
  },
  {
    id: "avatar_4",
    url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Smokey&backgroundColor=fde68a",
    name: "Smokey",
  },
  {
    id: "avatar_5",
    url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Buster&backgroundColor=fed7aa",
    name: "Buster",
  },
  {
    id: "avatar_6",
    url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Midnight&backgroundColor=fecaca",
    name: "Midnight",
  },
  {
    id: "avatar_7",
    url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Lucky&backgroundColor=bbf7d0",
    name: "Lucky",
  },
  {
    id: "avatar_8",
    url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Princess&backgroundColor=e9d5ff",
    name: "Princess",
  },
  {
    id: "avatar_9",
    url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sammy&backgroundColor=fde047",
    name: "Sammy",
  },
  {
    id: "avatar_10",
    url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Oscar&backgroundColor=a7f3d0",
    name: "Oscar",
  },
  {
    id: "avatar_11",
    url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Luna&backgroundColor=fbb6ce",
    name: "Luna",
  },
  {
    id: "avatar_12",
    url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Max&backgroundColor=93c5fd",
    name: "Max",
  },
  {
    id: "avatar_13",
    url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Bella&backgroundColor=fdba74",
    name: "Bella",
  },
  {
    id: "avatar_14",
    url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Charlie&backgroundColor=c7d2fe",
    name: "Charlie",
  },
  {
    id: "avatar_15",
    url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Milo&backgroundColor=fef3c7",
    name: "Milo",
  },
  {
    id: "avatar_16",
    url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ruby&backgroundColor=f3e8ff",
    name: "Ruby",
  },
];

const getValidAvatars = () => {
  return PREDEFINED_AVATARS;
};

const isValidAvatar = (profilePicture) => {
  if (!profilePicture) return true; // Allow null/undefined for no avatar

  // Allow the default W3Schools avatar
  if (profilePicture === "https://www.w3schools.com/howto/img_avatar.png") {
    return true;
  }

  // Check if it's one of our predefined avatars
  return PREDEFINED_AVATARS.some(
    (avatar) => avatar.url === profilePicture || avatar.id === profilePicture
  );
};

const getAvatarUrl = (avatarIdOrUrl) => {
  if (!avatarIdOrUrl) return null;

  // If it's already a URL, return it
  if (avatarIdOrUrl.startsWith("http")) {
    return avatarIdOrUrl;
  }

  // If it's an ID, find the corresponding URL
  const avatar = PREDEFINED_AVATARS.find(
    (avatar) => avatar.id === avatarIdOrUrl
  );
  return avatar ? avatar.url : null;
};

module.exports = {
  PREDEFINED_AVATARS,
  getValidAvatars,
  isValidAvatar,
  getAvatarUrl,
};
