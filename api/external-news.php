<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: public, max-age=1800'); // 30 min cache

$feeds = [
  'https://data.gmanews.tv/gno/rss/news/feed.xml',
  'https://www.philstar.com/rss/headlines',
  'https://www.philstar.com/rss/business'
];

$keywords = ['oil', 'fuel', 'petroleum', 'lubricant', 'diesel', 'gasoline', 'energy', 'motor'];
$articles = [];

foreach ($feeds as $feedUrl) {
  $ctx = stream_context_create(['http' => ['timeout' => 5]]);
  $xml = @simplexml_load_file($feedUrl, 'SimpleXMLElement', LIBXML_NOCDATA, null, false);
  if (!$xml) continue;

  $namespaces = $xml->getNamespaces(true);

  $items = isset($xml->channel->item) ? $xml->channel->item : [];
  foreach ($items as $item) {
    $title = (string)($item->title ?? '');
    $desc  = strip_tags((string)($item->description ?? ''));
    $link  = (string)($item->link ?? '');
    $date  = (string)($item->pubDate ?? '');

    // Try to extract image
    $image = '';
    // Try enclosure tag
    if (isset($item->enclosure)) {
      $encType = (string)($item->enclosure['type'] ?? '');
      if (strpos($encType, 'image') !== false) {
        $image = (string)($item->enclosure['url'] ?? '');
      }
    }
    // Try media:content or media:thumbnail
    if (!$image && isset($namespaces['media'])) {
      $media = $item->children($namespaces['media']);
      if (isset($media->content)) {
        $image = (string)($media->content['url'] ?? '');
      }
      if (!$image && isset($media->thumbnail)) {
        $image = (string)($media->thumbnail['url'] ?? '');
      }
    }
    // Try image tag inside description HTML
    if (!$image) {
      $rawDesc = (string)($item->description ?? '');
      if (preg_match('/<img[^>]+src=["\']([^"\']+)["\']/', $rawDesc, $m)) {
        $image = $m[1];
      }
    }

    $matched = false;
    foreach ($keywords as $kw) {
      if (stripos($title, $kw) !== false || stripos($desc, $kw) !== false) {
        $matched = true;
        break;
      }
    }
    if ($matched && $link) {
      $articles[] = [
        'title'       => $title,
        'link'        => $link,
        'pubDate'     => $date,
        'description' => mb_substr($desc, 0, 200),
        'source'      => parse_url($feedUrl, PHP_URL_HOST),
        'image'       => $image
      ];
    }
  }
}

usort($articles, function($a, $b) {
  return strtotime($b['pubDate']) - strtotime($a['pubDate']);
});

echo json_encode(['items' => array_slice($articles, 0, 20)]);
