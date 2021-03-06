/**
 * @api {get} /superfeed_getPosts Get Posts
 * @apiGroup Posts
 * @apiDescription Gets all posts from a location
 *
 * @apiParam {Number[]} location The coordinates of where the user is located
 *
 * @apiSuccess {Post[]} posts Array of posts from the requested location
 */

import r from 'rethinkdb'
import i from 'instagram-node'
import Twitter from 'twitter'
import { DB } from '../../db'

export const method = 'GET'
export const path = '/api/getPosts'

function getTweets ({latitude, longitude}) {
  if (!process.env.TWITTER_CONSUMER_KEY || !process.env.TWITTER_CONSUMER_SECRET) {
    console.error('Warning: Twitter environment variables not defined')
    return []
  }

  const twitterClient = new Twitter({
    consumer_key: process.env.TWITTER_CONSUMER_KEY,
    consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
    access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
    access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
  })

  return new Promise(function (resolve, reject) {
    twitterClient.get('search/tweets', {
      geocode: (latitude + ',' + longitude + ',1mi'),
      count: 25
    }, function (error, tweets) {
      if (error) reject(error)
      resolve(tweets.statuses.map((tweet) => ({
        type: 'twitter',
        id: tweet.id,
        author: tweet.user.id,
        avatar: tweet.user.profile_image_url,
        name: tweet.user.name,
        body: tweet.text,
        created: tweet.created_at
      })))
    })
  })
}

function getIns (location) {
  let ig = i.instagram()

  ig.use({ access_token: '3178355401.1677ed0.117cca9f55c847018b161e79287dcac3' })

  return new Promise(function (resolve, reject) {
    let options = {}
    ig.location_media_recent(location, [options], function (err, result, pagination, remaining, limit) {
      if (err) reject(console.log(err))
      resolve(result.map(
        (insta) => ({
          type: 'instagram',
          id: insta.id,
          image: insta.images.standard_resolution.url,
          author: insta.user.id,
          name: insta.user.username,
          avator: insta.user.profile_picture,
          body: insta.caption,
          created: insta.created_time
        })
      ))
    })
  })
}

export const handler = async function (e) {
  let conn = await r.connect(DB)
  let cursor = await r.table('posts').orderBy({ index: r.desc('created') }).run(conn)
  let posts = await cursor.toArray()

  let tweets = await getTweets({
    latitude: 42.7299111,
    longitude: -73.6772041
  })

  let ins = await getIns('219471895') // it is location_id of troy

  let results = posts.concat(tweets).concat(ins).sort((a, b) => (new Date(b.created) - new Date(a.created)))

  return { posts: results }
}
