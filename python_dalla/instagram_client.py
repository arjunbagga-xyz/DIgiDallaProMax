import requests
import config

BASE_URL = "https://graph.facebook.com/v18.0"

def post_to_instagram(character, image_filename, caption):
    """
    Posts an image to Instagram using the Graph API.
    This is a two-step process: create a container, then publish it.
    """
    # 1. Check for required configuration
    if not character.get("instagram_account_id") or not character.get("instagram_access_token"):
        return {"success": False, "error": "Instagram credentials are not configured for this character."}

    if not config.PUBLIC_URL:
        return {"success": False, "error": "PUBLIC_URL is not configured in the application."}

    ig_user_id = character["instagram_account_id"]
    access_token = character["instagram_access_token"]
    image_url = f"{config.PUBLIC_URL}/outputs/{image_filename}"

    # 2. Create Media Container
    container_url = f"{BASE_URL}/{ig_user_id}/media"
    container_payload = {
        'image_url': image_url,
        'caption': caption,
        'access_token': access_token
    }

    try:
        print(f"Creating Instagram media container with URL: {image_url}")
        container_r = requests.post(container_url, data=container_payload)
        container_r.raise_for_status()
        container_result = container_r.json()
        creation_id = container_result.get('id')
        if not creation_id:
            return {"success": False, "error": f"Failed to create media container: {container_result}"}
        print(f"Media container created with ID: {creation_id}")
    except requests.exceptions.RequestException as e:
        return {"success": False, "error": f"API Error (creating container): {e}"}

    # 3. Publish Media Container
    publish_url = f"{BASE_URL}/{ig_user_id}/media_publish"
    publish_payload = {
        'creation_id': creation_id,
        'access_token': access_token
    }

    try:
        print(f"Publishing media container ID: {creation_id}")
        publish_r = requests.post(publish_url, data=publish_payload)
        publish_r.raise_for_status()
        publish_result = publish_r.json()
        if 'id' in publish_result:
            print(f"Successfully published to Instagram with post ID: {publish_result['id']}")
            return {"success": True, "post_id": publish_result['id']}
        else:
            return {"success": False, "error": f"Failed to publish container: {publish_result}"}
    except requests.exceptions.RequestException as e:
        return {"success": False, "error": f"API Error (publishing container): {e}"}
