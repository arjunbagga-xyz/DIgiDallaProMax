import tweepy
import requests
from .models import Character

def post_to_twitter(character: Character, image_path: str, caption: str):
    """
    Posts a tweet with an image to the specified character's Twitter account.
    """
    # Check for necessary credentials
    if not all([
        character.twitterAppKey,
        character.twitterAppSecret,
        character.twitterAccessToken,
        character.twitterAccessSecret
    ]):
        raise ValueError("Twitter API credentials are not fully configured for this character.")

    # Authenticate with Twitter API v2
    client = tweepy.Client(
        consumer_key=character.twitterAppKey,
        consumer_secret=character.twitterAppSecret,
        access_token=character.twitterAccessToken,
        access_token_secret=character.twitterAccessSecret
    )

    # Need to use API v1.1 for media uploads with tweepy
    auth = tweepy.OAuth1UserHandler(
        consumer_key=character.twitterAppKey,
        consumer_secret=character.twitterAppSecret,
        access_token=character.twitterAccessToken,
        access_token_secret=character.twitterAccessSecret
    )
    api_v1 = tweepy.API(auth)

    # Upload the image
    try:
        media = api_v1.media_upload(filename=image_path)
        media_id = media.media_id_string
    except Exception as e:
        raise Exception(f"Failed to upload media to Twitter: {e}")

    # Post the tweet with the media
    try:
        response = client.create_tweet(text=caption, media_ids=[media_id])
        tweet_data = response.data
        post_id = tweet_data['id']
        # The URL to a tweet is https://twitter.com/user/status/tweet_id
        # We need the user's handle for a perfect URL, but Twitter doesn't return it in the tweet response.
        # We can construct a generic one.
        post_url = f"https://twitter.com/anyuser/status/{post_id}"
        return {"post_id": post_id, "post_url": post_url}
    except Exception as e:
        raise Exception(f"Failed to create tweet: {e}")

import os
import time
from pyngrok import ngrok

def post_to_instagram(character: Character, image_path: str, caption: str):
    """
    Posts an image with a caption to the specified character's Instagram account.
    Uses ngrok to temporarily expose the local image file via a public URL.
    """
    if not all([character.instagramAccountId, character.instagramApiKey]):
        raise ValueError("Instagram Account ID and API Key are not configured for this character.")

    GRAPH_API_VERSION = "v18.0"
    base_url = f"https://graph.facebook.com/{GRAPH_API_VERSION}"

    # --- Step 1: Expose local image via ngrok ---
    image_dir = os.path.dirname(os.path.abspath(image_path))
    image_filename = os.path.basename(image_path)

    # Start an HTTP tunnel to the local directory
    public_url = ngrok.connect(f"file://{image_dir}").public_url
    image_public_url = f"{public_url}/{image_filename}"

    try:
        # --- Step 2: Create a media container on Instagram ---
        create_container_url = f"{base_url}/{character.instagramAccountId}/media"
        container_params = {
            'image_url': image_public_url,
            'caption': caption,
            'access_token': character.instagramApiKey
        }

        # Poll for container creation to complete
        creation_id = None
        for _ in range(10): # Poll for 50 seconds max
            response = requests.post(create_container_url, params=container_params)
            response.raise_for_status()
            data = response.json()
            creation_id = data.get('id')
            if creation_id:
                break
            time.sleep(5)

        if not creation_id:
            raise Exception("Failed to create Instagram media container in time.")

        # --- Step 3: Publish the container ---
        publish_url = f"{base_url}/{character.instagramAccountId}/media_publish"
        publish_params = {
            'creation_id': creation_id,
            'access_token': character.instagramApiKey
        }

        publish_response = requests.post(publish_url, params=publish_params)
        publish_response.raise_for_status()

        result = publish_response.json()
        post_id = result.get('id')

        if not post_id:
            raise Exception("Failed to publish Instagram media.")

        # NOTE: The Instagram Graph API does not return the post's shortcode directly.
        # The permalink field is available on the media object, but requires another API call to fetch.
        # For simplicity, we construct a generic URL. A production app might fetch the permalink.
        post_url = f"https://www.instagram.com/p/{post_id}/"
        return {"post_id": post_id, "post_url": post_url}

    finally:
        # --- Step 4: Clean up and close the tunnel ---
        ngrok.disconnect(public_url)
