import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useGroup } from "@/lib/nostr/groups";
import { useRelayInfo } from "@/lib/relay";
import { useProfile } from "@/lib/nostr";
import { cn } from "@/lib/utils";
import { extractGroupMetadata } from "./GroupMetadata";
import PropTypes from "prop-types";

/**
 * Group Avatar component that's optimized for displaying group/community avatars
 */
export function GroupPictureFromGroup({ group, className, size = "md", showFallback = true }) {
  // Handle the group object case with useGroup hook
  const { id, relay } = group;
  const { data: metadata } = useGroup({ id, relay });
  const { data: relayInfo } = useRelayInfo(relay);
  const isRelayGroup = id === "_";
  
  // Size classes for different avatar sizes
  const sizeClasses = {
    sm: "size-6",
    md: "size-8",
    lg: "size-12", 
    xl: "size-32"
  };
  
  // Use relay info for relay groups, otherwise use metadata
  const name = isRelayGroup ? relayInfo?.name : metadata?.name;
  const avatarUrl = isRelayGroup ? relayInfo?.icon : metadata?.picture;
  const fallbackText = name?.at(0) || id?.at(0) || "G";
  
  // Apply size class to avatar
  const avatarClass = cn("rounded-full", sizeClasses[size] || sizeClasses.md, className);
  
  return (
    <Avatar className={avatarClass}>
      {avatarUrl && <AvatarImage src={avatarUrl} className="object-cover" />}
      {showFallback && <AvatarFallback>{fallbackText}</AvatarFallback>}
    </Avatar>
  );
}

GroupPictureFromGroup.propTypes = {
  group: PropTypes.shape({
    id: PropTypes.string.isRequired,
    relay: PropTypes.string.isRequired
  }).isRequired,
  className: PropTypes.string,
  size: PropTypes.oneOf(["sm", "md", "lg", "xl"]),
  showFallback: PropTypes.bool
};

/**
 * Event Avatar component that's optimized for displaying avatar from event metadata
 */
export function GroupPictureFromEvent({ event, className, size = "md", showFallback = true }) {
  // First try our extractGroupMetadata function
  const metadata = extractGroupMetadata(event);
  
  // Size classes for different avatar sizes
  const sizeClasses = {
    sm: "size-6",
    md: "size-8",
    lg: "size-12", 
    xl: "size-32"
  };
  
  let avatarUrl = metadata.picture;
  const name = metadata.name;
  
  // If no picture found, try direct tag access for different field names
  if (!avatarUrl) {
    avatarUrl = event.tags.find(t => t[0] === "picture")?.[1] || 
                event.tags.find(t => t[0] === "image")?.[1] || 
                event.tags.find(t => t[0] === "avatar")?.[1] ||
                event.tags.find(t => t[0] === "icon")?.[1];
  }
  
  // Get identifier from d tag for fallback
  const id = event.tags.find(t => t[0] === "d")?.[1];
  const fallbackText = name?.at(0) || id?.at(0) || event.id?.at(0) || "G";
  
  // Apply size class to avatar
  const avatarClass = cn("rounded-full", sizeClasses[size] || sizeClasses.md, className);
  
  return (
    <Avatar className={avatarClass}>
      {avatarUrl && <AvatarImage src={avatarUrl} className="object-cover" />}
      {showFallback && <AvatarFallback>{fallbackText}</AvatarFallback>}
    </Avatar>
  );
}

GroupPictureFromEvent.propTypes = {
  event: PropTypes.shape({
    id: PropTypes.string,
    pubkey: PropTypes.string,
    content: PropTypes.string,
    tags: PropTypes.arrayOf(PropTypes.array)
  }).isRequired,
  className: PropTypes.string,
  size: PropTypes.oneOf(["sm", "md", "lg", "xl"]),
  showFallback: PropTypes.bool
};

/**
 * Profile Avatar component that's optimized for displaying avatar from pubkey
 */
export function ProfilePicture({ pubkey, className, size = "md", showFallback = true }) {
  const { data: profile } = useProfile(pubkey);
  
  // Size classes for different avatar sizes
  const sizeClasses = {
    sm: "size-6",
    md: "size-8",
    lg: "size-12", 
    xl: "size-32"
  };
  
  const avatarUrl = profile?.picture;
  const name = profile?.name;
  const fallbackText = name?.at(0) || pubkey?.at(0) || "N";
  
  // Apply size class to avatar
  const avatarClass = cn("rounded-full", sizeClasses[size] || sizeClasses.md, className);
  
  return (
    <Avatar className={avatarClass}>
      {avatarUrl && <AvatarImage src={avatarUrl} className="object-cover" />}
      {showFallback && <AvatarFallback>{fallbackText}</AvatarFallback>}
    </Avatar>
  );
}

ProfilePicture.propTypes = {
  pubkey: PropTypes.string.isRequired,
  className: PropTypes.string,
  size: PropTypes.oneOf(["sm", "md", "lg", "xl"]),
  showFallback: PropTypes.bool
};

/**
 * Universal Avatar component that handles multiple data sources
 * You can pass either group, event or pubkey
 */
export function UniversalAvatar(props) {
  const { group, event, pubkey } = props;
  
  if (group) {
    return <GroupPictureFromGroup {...props} />;
  } else if (event) {
    return <GroupPictureFromEvent {...props} />;
  } else if (pubkey) {
    return <ProfilePicture {...props} />;
  }
  
  // Fallback
  return (
    <Avatar className={cn("rounded-full", props.className)}>
      <AvatarFallback>?</AvatarFallback>
    </Avatar>
  );
}

UniversalAvatar.propTypes = {
  group: PropTypes.shape({
    id: PropTypes.string.isRequired,
    relay: PropTypes.string.isRequired
  }),
  event: PropTypes.shape({
    id: PropTypes.string,
    pubkey: PropTypes.string,
    tags: PropTypes.arrayOf(PropTypes.array),
    content: PropTypes.string
  }),
  pubkey: PropTypes.string,
  className: PropTypes.string,
  size: PropTypes.oneOf(["sm", "md", "lg", "xl"]),
  showFallback: PropTypes.bool
};

/**
 * Helper function to get name from group, event or pubkey
 */
export function getGroupName(group, event, pubkey) {
  // Case 1: Group provided
  if (group) {
    const { id } = group;
    // Direct hook calls removed to prevent conditional hook errors
    return `Group ${id.slice(0, 8)}`;
  }
  
  // Case 2: Event provided
  else if (event) {
    // Try our extractGroupMetadata function
    const metadata = extractGroupMetadata(event);
    
    // If no name from metadata extraction, try direct tag access
    const name = metadata.name || 
                 event.tags.find(t => t[0] === "name")?.[1] || 
                 event.tags.find(t => t[0] === "title")?.[1];
    
    // Get identifier from d tag for fallback
    const id = event.tags.find(t => t[0] === "d")?.[1];
    
    return name || (id ? `Group ${id.slice(0, 8)}` : "Unknown Group");
  }
  
  // Case 3: Just pubkey provided
  else if (pubkey) {
    // Direct hook calls removed to prevent conditional hook errors
    return `User ${pubkey.slice(0, 8)}`;
  }
  
  return "Unknown";
}

/**
 * Group Name component that handles the group case
 */
export function GroupNameFromGroup({ group, className }) {
  const { id, relay } = group;
  const { data: metadata } = useGroup({ id, relay });
  const { data: relayInfo } = useRelayInfo(relay);
  const isRelayGroup = id === "_";
  
  const name = isRelayGroup ? relayInfo?.name : metadata?.name || id.slice(0, 8);
  
  return <span className={className}>{name}</span>;
}

GroupNameFromGroup.propTypes = {
  group: PropTypes.shape({
    id: PropTypes.string.isRequired,
    relay: PropTypes.string.isRequired
  }).isRequired,
  className: PropTypes.string
};

/**
 * Event Name component that handles the event case
 */
export function GroupNameFromEvent({ event, className }) {
  const metadata = extractGroupMetadata(event);
  
  // If no name from metadata extraction, try direct tag access
  const name = metadata.name || 
               event.tags.find(t => t[0] === "name")?.[1] || 
               event.tags.find(t => t[0] === "title")?.[1];
  
  // Get identifier from d tag for fallback
  const id = event.tags.find(t => t[0] === "d")?.[1];
  
  const displayName = name || (id ? `Group ${id.slice(0, 8)}` : "Unknown Group");
  
  return <span className={className}>{displayName}</span>;
}

GroupNameFromEvent.propTypes = {
  event: PropTypes.shape({
    tags: PropTypes.arrayOf(PropTypes.array)
  }).isRequired,
  className: PropTypes.string
};

/**
 * Profile Name component that handles the pubkey case
 */
export function ProfileName({ pubkey, className }) {
  const { data: profile } = useProfile(pubkey);
  const name = profile?.name || profile?.displayName || `User ${pubkey.slice(0, 8)}`;
  
  return <span className={className}>{name}</span>;
}

ProfileName.propTypes = {
  pubkey: PropTypes.string.isRequired,
  className: PropTypes.string
};

/**
 * Universal component for displaying name from various sources
 */
export function UniversalName(props) {
  const { group, event, pubkey, className } = props;
  
  if (group) {
    return <GroupNameFromGroup group={group} className={className} />;
  } else if (event) {
    return <GroupNameFromEvent event={event} className={className} />;
  } else if (pubkey) {
    return <ProfileName pubkey={pubkey} className={className} />;
  }
  
  return <span className={className}>Unknown</span>;
}

UniversalName.propTypes = {
  group: PropTypes.shape({
    id: PropTypes.string,
    relay: PropTypes.string
  }),
  event: PropTypes.shape({
    tags: PropTypes.arrayOf(PropTypes.array)
  }),
  pubkey: PropTypes.string,
  className: PropTypes.string
}; 