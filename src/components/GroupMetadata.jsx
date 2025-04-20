import { MessagesSquare, CloudUpload, Landmark, Server, Castle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { RichText } from "@/components/rich-text";
import { useTranslation } from "react-i18next";
import { useOpenGroup } from "@/lib/groups";
import PropTypes from "prop-types";
import { useProfile } from "@/lib/nostr";
import { useNavigate } from "react-router-dom";
import { Avatar as NostrAvatar } from "@/components/nostr/avatar";
import { Name } from "@/components/nostr/name";
import { BlossomLink } from "@/components/blossom";
import { RelayLink } from "@/components/relay";
import { MintLink } from "@/components/mint";
import { useCommunity } from "@/lib/nostr/groups";

/**
 * Extracts metadata from a NIP-29 group event
 * Handles both content-based and tag-based metadata formats
 */
function extractGroupMetadata(event) {
  if (!event) {
    return { name: 'Unknown Group', about: 'No event data available' };
  }

  // First try to parse content as JSON
  let metadata = {};
  if (event.content && event.content.trim() !== '') {
    try {
      metadata = JSON.parse(event.content);
    } catch {
      console.log('Content is not valid JSON, extracting from tags');
    }
  }
  
  // If content parsing failed or we didn't get required fields,
  // extract metadata from tags (NIP-29 allows both approaches)
  if (!metadata.name || !metadata.about) {
    // Extract metadata from tags
    event.tags.forEach(tag => {
      if (tag[0] === 'name' && tag[1]) metadata.name = tag[1];
      else if (tag[0] === 'about' && tag[1]) metadata.about = tag[1]; 
      else if (tag[0] === 'description' && tag[1]) metadata.about = tag[1];
      else if ((tag[0] === 'picture' || tag[0] === 'image') && tag[1]) metadata.picture = tag[1];
    });
  }
  
  // Fallback values if still missing
  if (!metadata.name) {
    const d_tag = event.tags.find(t => t[0] === 'd');
    metadata.name = d_tag ? `Group ${d_tag[1].substring(0, 8)}` : 'Unknown Group';
  }
  
  if (!metadata.about) {
    metadata.about = 'No description available';
  }
  
  return metadata;
}

// The enhanced version of GroupMetadata which properly handles both content and tag based metadata
export function EnhancedGroupMetadata({
  event,
  group,
  relays,
  className,
}) {
  const id = event.tags.find((t) => t[0] === "d")?.[1] ?? "_";
  const relay = relays[0];
  
  // Extract metadata from the event using our robust extraction function
  const metadata = extractGroupMetadata(event);
  
  const openGroup = useOpenGroup({ id, relay });
  const { t } = useTranslation();
  
  return (
    <div className={className}>
      <div className="flex flex-col gap-1 items-center">
        <Avatar className="rounded-full size-32">
          <AvatarImage src={metadata.picture} className="object-cover" />
          <AvatarFallback>{metadata.name?.at(0) || id.at(0)}</AvatarFallback>
        </Avatar>
        <h2 className="text-lg font-semibold">{metadata.name}</h2>
        {metadata.about ? (
          <RichText
            tags={event.tags}
            group={group}
            className="text-sm text-center text-muted-foreground"
          >
            {metadata.about}
          </RichText>
        ) : null}
      </div>
      <Button size="sm" onClick={openGroup}>
        <MessagesSquare /> {t("group.metadata.join-the-conversation")}
      </Button>
    </div>
  );
}

EnhancedGroupMetadata.propTypes = {
  event: PropTypes.shape({
    content: PropTypes.string,
    tags: PropTypes.arrayOf(PropTypes.array),
    pubkey: PropTypes.string,
  }).isRequired,
  group: PropTypes.object,
  relays: PropTypes.arrayOf(PropTypes.string).isRequired,
  className: PropTypes.string,
};

// Direct replacement for the original GroupMetadata component
export function GroupMetadata(props) {
  return <EnhancedGroupMetadata {...props} />;
}

GroupMetadata.propTypes = EnhancedGroupMetadata.propTypes;

// Enhanced version of CommunityMetadata
export function EnhancedCommunityMetadata({
  event,
  group,
  hideDetails,
  className,
}) {
  const { data: profile } = useProfile(event.pubkey);
  const community = useCommunity(event.pubkey);
  const navigate = useNavigate();

  function openGroup() {
    navigate(`/c/${event.pubkey}`);
  }
  const { t } = useTranslation();
  
  // Get metadata with our enhanced extraction function
  const extractedMetadata = extractGroupMetadata(event);
  
  // Combine with profile data if available
  const metadata = {
    ...extractedMetadata,
    // Use profile data as fallback if available
    name: extractedMetadata.name || profile?.name || `Community ${event.pubkey.slice(0, 8)}`,
    about: extractedMetadata.about || profile?.about,
    picture: extractedMetadata.picture || profile?.picture
  };

  return (
    <div className={className}>
      <div className="flex flex-row gap-3 items-center">
        <Castle className="size-8 text-muted-foreground" />
        <div className="flex flex-row gap-2 items-center">
          <NostrAvatar pubkey={event.pubkey} className="size-8" />
          <div className="flex flex-col gap-0 items-start">
            <h3 className="text-lg font-semibold line-clamp-1">
              {metadata.name || <Name pubkey={event.pubkey} />}
            </h3>
            {metadata.about ? (
              <RichText
                tags={event.tags}
                group={group}
                className="text-sm text-center text-muted-foreground line-clamp-1"
                options={{
                  inline: true,
                }}
              >
                {metadata.about}
              </RichText>
            ) : null}
          </div>
        </div>
      </div>
      {!hideDetails && (
        <>
          {community?.relay ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Server className="size-4 text-muted-foreground" />
                <h3 className="text-sm text-muted-foreground uppercase">
                  {t("community.relays.title")}
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <RelayLink
                  relay={community.relay}
                  classNames={{ icon: "size-4", name: "text-sm" }}
                />
              </div>
            </div>
          ) : null}

          {community?.blossom && community.blossom.length > 0 ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <CloudUpload className="size-4 text-muted-foreground" />
                <h3 className="text-sm text-muted-foreground uppercase">
                  {t("community.blossom.title")}
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {community.blossom.map((blossom) => (
                  <BlossomLink
                    key={blossom}
                    url={blossom}
                    classNames={{ icon: "size-4", name: "text-sm" }}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {community?.mint ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Landmark className="size-4 text-muted-foreground" />
                <h3 className="text-sm text-muted-foreground uppercase">
                  {t("community.mint.title")}
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <MintLink
                  url={community.mint}
                  classNames={{ icon: "size-4", name: "text-sm" }}
                />
              </div>
            </div>
          ) : null}
          <Button size="sm" onClick={openGroup}>
            <MessagesSquare /> {t("group.metadata.join-the-conversation")}
          </Button>
        </>
      )}
    </div>
  );
}

EnhancedCommunityMetadata.propTypes = {
  event: PropTypes.shape({
    content: PropTypes.string,
    tags: PropTypes.arrayOf(PropTypes.array),
    pubkey: PropTypes.string,
  }).isRequired,
  group: PropTypes.object,
  hideDetails: PropTypes.bool,
  className: PropTypes.string,
};

// Direct replacement for the original CommunityMetadata component
export function CommunityMetadata(props) {
  return <EnhancedCommunityMetadata {...props} />;
}

CommunityMetadata.propTypes = EnhancedCommunityMetadata.propTypes;

// Enhanced version of CommunitySummary
export function EnhancedCommunitySummary({
  event,
  group,
}) {
  const { data: profile } = useProfile(event.pubkey);
  const navigate = useNavigate();
  
  // Get metadata with our enhanced extraction function
  const extractedMetadata = extractGroupMetadata(event);
  
  // Combine with profile data if available
  const metadata = {
    ...extractedMetadata,
    // Use profile data as fallback if available
    name: extractedMetadata.name || profile?.name,
    about: extractedMetadata.about || profile?.about,
    picture: extractedMetadata.picture || profile?.picture
  };
  
  function openGroup() {
    navigate(`/c/${event.pubkey}`);
  }
  
  return (
    <Button variant="outline" size="fit" onClick={openGroup}>
      <div className="p-2 space-y-3 w-64 rounded-sm">
        <div className="flex flex-col gap-1 items-center">
          <NostrAvatar pubkey={event.pubkey} className="size-12" />
          <div className="flex flex-col gap-0.5">
            <h3 className="text-lg font-semibold line-clamp-1">
              {metadata.name || <Name pubkey={event.pubkey} />}
            </h3>
            {metadata.about ? (
              <RichText
                tags={event.tags}
                group={group}
                className="text-xs text-center text-muted-foreground line-clamp-2"
                options={{
                  inline: true,
                }}
              >
                {metadata.about}
              </RichText>
            ) : null}
          </div>
        </div>
      </div>
    </Button>
  );
}

EnhancedCommunitySummary.propTypes = {
  event: PropTypes.shape({
    content: PropTypes.string,
    tags: PropTypes.arrayOf(PropTypes.array),
    pubkey: PropTypes.string,
  }).isRequired,
  group: PropTypes.object,
};

// Direct replacement for the original CommunitySummary component
export function CommunitySummary(props) {
  return <EnhancedCommunitySummary {...props} />;
}

CommunitySummary.propTypes = EnhancedCommunitySummary.propTypes;

// Export the utility function so it can be used elsewhere
export { extractGroupMetadata }; 