/* Shared photo library for the academy pages (v44). */
window.ACAD = (function () {
  var POOL = [
    'https://assets.mixkit.co/videos/50641/50641-thumb-720-0.jpg',
    'https://assets.mixkit.co/videos/44071/44071-thumb-720-0.jpg',
    'https://assets.mixkit.co/videos/44076/44076-thumb-720-0.jpg',
    'https://assets.mixkit.co/videos/50639/50639-thumb-720-0.jpg',
    'https://assets.mixkit.co/videos/44074/44074-thumb-720-0.jpg',
    'https://assets.mixkit.co/videos/44069/44069-thumb-720-0.jpg',
    'https://assets.mixkit.co/videos/44073/44073-thumb-720-0.jpg',
    'https://assets.mixkit.co/videos/50635/50635-thumb-720-0.jpg',
    'https://assets.mixkit.co/videos/44068/44068-thumb-720-0.jpg',
    'https://assets.mixkit.co/videos/44075/44075-thumb-720-0.jpg'
  ];
  return {
    pool: POOL,
    img: function (i) { return POOL[Math.abs(i) % POOL.length]; },
    /* A course photo if the course has one, otherwise a photo from the library */
    courseImg: function (c, i) { return c && c.hasImage ? '/api/courses/' + encodeURIComponent(c.id) + '/image' : POOL[Math.abs(i) % POOL.length]; }
  };
})();
