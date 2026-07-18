export const parseRepoSpec = value => {
  const parts = value.trim().split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error("Repository must look like owner/repo");
  }

  return {
    owner: parts[0],
    repo: parts[1],
  };
};

export const encodeGitHubContent = text => {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

export const decodeGitHubContent = content => {
  const compact = content.replace(/\s/g, "");
  const binary = atob(compact);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

export const createGitHubStorage = ({ token, owner, repo, branch = "main", root = "" }) => {
  const baseUrl = `https://api.github.com/repos/${owner}/${repo}/contents`;
  const rootPrefix = root.trim().replace(/^\/+|\/+$/g, "");
  const apiPath = path => [rootPrefix, path].filter(Boolean).join("/");

  const request = async (path, options = {}) => {
    const response = await fetch(`${baseUrl}/${encodeURI(apiPath(path))}?ref=${encodeURIComponent(branch)}`, {
      ...options,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...options.headers,
      },
    });

    if (response.status === 404) return null;

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.message || `GitHub request failed: ${response.status}`);
    }

    return data;
  };

  const getText = async path => {
    const data = await request(path);
    if (!data) return null;
    if (Array.isArray(data) || data.type !== "file") {
      throw new Error(`${path} is not a file`);
    }

    return {
      text: decodeGitHubContent(data.content),
      sha: data.sha,
    };
  };

  const putText = async (path, text, { sha, message } = {}) => {
    const response = await fetch(`${baseUrl}/${encodeURI(apiPath(path))}`, {
      method: "PUT",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        message: message || `Update ${path}`,
        content: encodeGitHubContent(text),
        branch,
        ...(sha ? { sha } : {}),
      }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.message || `GitHub save failed: ${response.status}`);
    }

    return {
      sha: data.content.sha,
      commitSha: data.commit.sha,
    };
  };

  return {
    getText,
    putText,
  };
};
