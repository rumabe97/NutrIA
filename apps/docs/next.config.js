import createMDX from '@next/mdx';

const withMDX = createMDX({
  options: {
    // GitHub-flavored Markdown: tables, task lists, strikethrough, autolinks. Specifically
    // unlocks `| col | col |` table syntax — without this plugin MDX renders table rows as
    // literal pipe-character text.
    //
    // Plugin must be a string (not the imported function) so Turbopack can serialize the
    // loader options. Passing the imported function fails with
    //   "loader does not have serializable options".
    remarkPlugins: [['remark-gfm']]
  }
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { hostname: 'picsum.photos', protocol: 'https' },
      { hostname: 'github.com', protocol: 'https' },
    ],
  },
  pageExtensions: ['ts', 'tsx', 'mdx'],
};

export default withMDX(nextConfig);
