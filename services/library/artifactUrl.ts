// Git LFS downloads use the media endpoint; metadata/manifests stay on raw.
export const toMediaGitHubUrl = (value: string): string => {
  try {
    const url = new URL(value);
    if (url.hostname !== 'raw.githubusercontent.com') {
      return value;
    }

    const [, owner, repo, ...rest] = url.pathname.split('/');
    if (!owner || !repo || rest.length === 0) {
      return value;
    }

    return `https://media.githubusercontent.com/media/${owner}/${repo}/${rest.join('/')}`;
  } catch {
    return value;
  }
};
